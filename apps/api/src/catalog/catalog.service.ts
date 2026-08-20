import { Inject, Injectable } from "@nestjs/common";
import type { categorySchema, patchProductSchema, productSchema, recipeSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber, roundMoney, roundQty } from "../common/money.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

type CategoryBody = z.infer<typeof categorySchema>;
type ProductBody = z.infer<typeof productSchema>;
type PatchProductBody = z.infer<typeof patchProductSchema>;
type RecipeBody = z.infer<typeof recipeSchema>;

function isPrismaUniqueError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function getPrismaUniqueTargets(error: unknown): string[] {
  if (!error || typeof error !== "object" || !("meta" in error) || !error.meta || typeof error.meta !== "object") {
    return [];
  }

  const target = "target" in error.meta ? error.meta.target : undefined;
  if (Array.isArray(target)) {
    return target.filter((value): value is string => typeof value === "string");
  }

  if (typeof target === "string") {
    return [target];
  }

  return [];
}

function hasUniqueTarget(error: unknown, field: string): boolean {
  return getPrismaUniqueTargets(error).includes(field);
}

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCategories(currentUser: JwtPayload) {
    return this.prisma.category.findMany({
      where: { tenantId: currentUser.tid, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async createCategory(currentUser: JwtPayload, body: CategoryBody) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    try {
      const category = await this.prisma.category.create({
        data: {
          tenantId: currentUser.tid,
          name: body.name,
          sortOrder: body.sortOrder ?? 0,
        },
      });
      await writeAudit(this.prisma, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CREATE",
        module: "product",
        entity: "category",
        entityId: category.id,
      });
      return category;
    } catch {
      throw new AppError("CONFLICT", "Nama kategori sudah dipakai.", 409);
    }
  }

  async updateCategory(currentUser: JwtPayload, id: string, body: CategoryBody) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.getCategory(currentUser.tid, id);
    return this.prisma.category.update({
      where: { id },
      data: { name: body.name, sortOrder: body.sortOrder ?? 0 },
    });
  }

  async deleteCategory(currentUser: JwtPayload, id: string) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.getCategory(currentUser.tid, id);
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async listProducts(
    currentUser: JwtPayload,
    query?: { q?: string; categoryId?: string; productType?: string; activeOnly?: boolean },
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId: currentUser.tid,
        deletedAt: null,
        ...(query?.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query?.productType ? { productType: query.productType } : {}),
        ...(query?.activeOnly ? { isActive: true } : {}),
        ...(query?.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { barcode: query.q },
              ],
            }
          : {}),
      },
      include: { category: true, images: true, recipeAsMenu: true },
      orderBy: { name: "asc" },
    });

    return products.map((product) => this.toProduct(product));
  }

  async getProduct(currentUser: JwtPayload, id: string) {
    const product = await this.getProductRecord(currentUser, id);
    return this.toProduct(product);
  }

  async createProduct(currentUser: JwtPayload, body: ProductBody) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    let productId = "";
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            tenantId: currentUser.tid,
            outletId: outlet.id,
            name: body.name,
            productType: body.productType,
            unit: body.unit,
            categoryId: body.categoryId,
            supplierId: body.supplierId,
            sku: body.sku,
            barcode: body.barcode,
            buyPrice: body.buyPrice,
            sellPrice: body.sellPrice,
            avgCost: body.productType === "RECIPE" ? 0 : body.buyPrice,
            minStock: body.minStock ?? 0,
            isActive: body.isActive ?? true,
          },
        });

        if (body.imageUrl) {
          await tx.productImage.create({
            data: {
              tenantId: currentUser.tid,
              productId: created.id,
              storagePath: body.imageUrl,
            },
          });
        }

        await writeAudit(tx, {
          tenantId: currentUser.tid,
          userId: currentUser.sub,
          action: "CREATE",
          module: "product",
          entity: "product",
          entityId: created.id,
        });

        return created;
      });
      productId = product.id;
    } catch (error) {
      this.rethrowProductConflict(error);
    }

    return this.getProduct(currentUser, productId);
  }

  async updateProduct(currentUser: JwtPayload, id: string, body: PatchProductBody) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    const currentProduct = await this.getProductRecord(currentUser, id);

    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          name: "name" in body ? body.name : currentProduct.name,
          productType: "productType" in body ? body.productType : currentProduct.productType,
          unit: "unit" in body ? body.unit : currentProduct.unit,
          categoryId: "categoryId" in body ? body.categoryId : currentProduct.categoryId,
          supplierId: "supplierId" in body ? body.supplierId : currentProduct.supplierId,
          sku: "sku" in body ? body.sku : currentProduct.sku,
          barcode: "barcode" in body ? body.barcode : currentProduct.barcode,
          buyPrice: "buyPrice" in body ? body.buyPrice : asNumber(currentProduct.buyPrice),
          sellPrice: "sellPrice" in body ? body.sellPrice : asNumber(currentProduct.sellPrice),
          minStock: "minStock" in body ? (body.minStock ?? 0) : asNumber(currentProduct.minStock),
          isActive: "isActive" in body ? (body.isActive ?? true) : currentProduct.isActive,
        },
      });

      if ("imageUrl" in body) {
        await this.prisma.productImage.deleteMany({ where: { productId: id, tenantId: currentUser.tid } });
        if (body.imageUrl) {
          await this.prisma.productImage.create({
            data: { tenantId: currentUser.tid, productId: id, storagePath: body.imageUrl },
          });
        }
      }
    } catch (error) {
      this.rethrowProductConflict(error);
    }

    return this.getProduct(currentUser, id);
  }

  async deleteProduct(currentUser: JwtPayload, id: string) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.getProduct(currentUser, id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { success: true };
  }

  async replaceRecipe(currentUser: JwtPayload, productId: string, body: RecipeBody) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    const menu = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: currentUser.tid, deletedAt: null },
    });
    if (!menu || menu.productType !== "RECIPE") {
      throw new AppError("VALIDATION_ERROR", "Resep hanya untuk produk RECIPE.", 400);
    }

    const ingredientIds = body.items.map((item) => item.ingredientId);
    if (ingredientIds.includes(productId)) {
      throw new AppError("VALIDATION_ERROR", "Bahan tidak boleh merujuk menu itu sendiri.", 400);
    }

    const ingredients = await this.prisma.product.findMany({
      where: { id: { in: ingredientIds }, tenantId: currentUser.tid, deletedAt: null },
    });
    if (ingredients.length !== ingredientIds.length) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    if (ingredients.some((item) => item.productType === "RECIPE")) {
      throw new AppError("VALIDATION_ERROR", "Bahan resep harus INGREDIENT atau SIMPLE.", 400);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { tenantId: currentUser.tid, productId } });
      await tx.recipeItem.createMany({
        data: body.items.map((item) => {
          const ingredient = ingredients.find((row) => row.id === item.ingredientId)!;
          return {
            tenantId: currentUser.tid,
            productId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: ingredient.unit,
          };
        }),
      });
    });

    return this.getProduct(currentUser, productId);
  }

  recipeCost(items: Array<{ quantity: unknown; ingredient: { avgCost: unknown } }>) {
    return roundMoney(
      items.reduce((sum, item) => sum + asNumber(item.quantity) * asNumber(item.ingredient.avgCost), 0),
    );
  }

  private async getCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!category) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return category;
  }

  private async getProductRecord(currentUser: JwtPayload, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: currentUser.tid, deletedAt: null },
      include: {
        category: true,
        images: true,
        recipeAsMenu: { include: { ingredient: true } },
      },
    });
    if (!product) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return product;
  }

  private rethrowProductConflict(error: unknown): never {
    if (isPrismaUniqueError(error) && hasUniqueTarget(error, "barcode")) {
      throw new AppError("VALIDATION_ERROR", "Barcode sudah dipakai produk lain.", 400);
    }

    throw error;
  }

  private toProduct(product: {
    id: string;
    name: string;
    productType: string;
    unit: string;
    sku: string | null;
    barcode: string | null;
    categoryId?: string | null;
    buyPrice: unknown;
    sellPrice: unknown;
    avgCost: unknown;
    stock: unknown;
    minStock: unknown;
    isActive: boolean;
    category: { id: string; name: string } | null;
    images: Array<{ storagePath: string }>;
    recipeAsMenu?: Array<{ ingredientId: string; quantity: unknown; unit: string; ingredient?: { name: string; avgCost: unknown } }>;
  }) {
    const recipeItems = product.recipeAsMenu ?? [];
    const hpp = recipeItems.length
      ? this.recipeCost(recipeItems.map((item) => ({ quantity: item.quantity, ingredient: item.ingredient ?? { avgCost: 0 } })))
      : roundMoney(asNumber(product.avgCost));

    return {
      id: product.id,
      name: product.name,
      productType: product.productType,
      unit: product.unit,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: product.categoryId ?? product.category?.id ?? null,
      buyPrice: asNumber(product.buyPrice),
      sellPrice: asNumber(product.sellPrice),
      avgCost: asNumber(product.avgCost),
      stock: roundQty(asNumber(product.stock)),
      minStock: asNumber(product.minStock),
      isActive: product.isActive,
      hpp,
      category: product.category,
      imageUrl: product.images[0]?.storagePath ?? null,
      recipe: recipeItems.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: asNumber(item.quantity),
        unit: item.unit,
        ingredientName: item.ingredient?.name,
      })),
    };
  }
}
