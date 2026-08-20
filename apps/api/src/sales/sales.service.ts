import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@kranjang/db";
import type { cashierCloseSchema, cashierOpenSchema, dateRangeQuerySchema, saleCancelSchema, saleSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber, roundMoney } from "../common/money.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { applyStockMovement } from "../inventory/inventory.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class SalesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async currentSession(currentUser: JwtPayload) {
    return this.prisma.cashierSession.findFirst({
      where: { tenantId: currentUser.tid, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
  }

  async openSession(currentUser: JwtPayload, body: z.infer<typeof cashierOpenSchema>) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    const existing = await this.currentSession(currentUser);
    if (existing) {
      throw new AppError("VALIDATION_ERROR", "Sesi kasir masih terbuka.", 400);
    }
    return this.prisma.cashierSession.create({
      data: {
        tenantId: currentUser.tid,
        outletId: outlet.id,
        openedById: currentUser.sub,
        openingCash: body.openingCash ?? 0,
        openedAt: new Date(),
        status: "OPEN",
      },
    });
  }

  async closeSession(currentUser: JwtPayload, id: string, body: z.infer<typeof cashierCloseSchema>) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.cashierSession.findFirst({
        where: { id, tenantId: currentUser.tid, status: "OPEN" },
      });
      if (!session) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }

      const summary = await this.summarizeSession(tx, currentUser.tid, session.id, session.openingCash, body.closingCash);
      const closedAt = new Date();
      const updated = await tx.cashierSession.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt,
          closedById: currentUser.sub,
          closingCash: body.closingCash,
        },
      });

      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CASHIER_CLOSE",
        module: "sales",
        entity: "cashier_session",
        entityId: updated.id,
        newValue: {
          closingNotes: body.closingNotes ?? null,
          summary,
        },
      });

      return {
        id: updated.id,
        status: "CLOSED" as const,
        openingCash: asNumber(updated.openingCash),
        closingCash: asNumber(updated.closingCash ?? 0),
        closedAt: (updated.closedAt ?? closedAt).toISOString(),
        summary,
      };
    });
  }

  async listSales(currentUser: JwtPayload, query: z.infer<typeof dateRangeQuerySchema> = {}) {
    const soldAt =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
          }
        : undefined;
    const rows = await this.prisma.sale.findMany({
      where: {
        tenantId: currentUser.tid,
        ...(query.status ? { status: query.status } : {}),
        ...(soldAt ? { soldAt } : {}),
      },
      include: { items: true, payments: true, customer: true },
      orderBy: { soldAt: "desc" },
      take: 100,
    });
    return rows.map((row) => this.toSale(row));
  }

  async getSale(currentUser: JwtPayload, id: string) {
    const row = await this.prisma.sale.findFirst({
      where: { id, tenantId: currentUser.tid },
      include: { items: true, payments: true, customer: true },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return this.toSale(row);
  }

  async createSale(currentUser: JwtPayload, body: z.infer<typeof saleSchema>) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    const session = await this.currentSession(currentUser);
    if (!session) {
      throw new AppError("VALIDATION_ERROR", "Buka sesi kasir terlebih dahulu.", 400);
    }

    const settings = tenant.settings;
    const taxPercent = asNumber(settings?.taxPercent ?? 0);
    const taxInclusive = settings?.taxInclusive ?? true;

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: body.items.map((item) => item.productId) },
          tenantId: currentUser.tid,
          deletedAt: null,
        },
        include: { recipeAsMenu: { include: { ingredient: true } } },
      });

      const prepared = [];
      for (const line of body.items) {
        const product = products.find((row) => row.id === line.productId);
        if (!product || !product.isActive) {
          throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
        }
        if (product.productType === "RECIPE" && product.recipeAsMenu.length === 0) {
          throw new AppError("VALIDATION_ERROR", `${product.name} belum punya resep.`, 400);
        }

        const qty = line.quantity;
        const unitPrice = asNumber(product.sellPrice);
        const lineDiscount = line.discountAmount ?? 0;
        const lineTotal = roundMoney(unitPrice * qty - lineDiscount);
        let cogs = 0;
        const recipeSnapshot =
          product.productType === "RECIPE"
            ? product.recipeAsMenu.map((item) => ({
                ingredientId: item.ingredientId,
                quantity: asNumber(item.quantity),
                avgCost: asNumber(item.ingredient.avgCost),
              }))
            : null;

        if (product.productType === "SIMPLE" || product.productType === "INGREDIENT") {
          cogs = roundMoney(asNumber(product.avgCost) * qty);
        } else {
          for (const item of product.recipeAsMenu) {
            const need = asNumber(item.quantity) * qty;
            cogs += asNumber(item.ingredient.avgCost) * need;
          }
          cogs = roundMoney(cogs);
        }

        prepared.push({
          product,
          qty,
          unitPrice,
          lineDiscount,
          lineTotal,
          cogs,
          recipeSnapshot,
        });
      }

      const subtotal = roundMoney(prepared.reduce((sum, item) => sum + item.lineTotal, 0));
      const headerDiscount = body.discountAmount ?? 0;
      const afterDiscount = roundMoney(Math.max(0, subtotal - headerDiscount));
      const taxAmount = taxInclusive
        ? roundMoney(afterDiscount - afterDiscount / (1 + taxPercent / 100))
        : roundMoney(afterDiscount * (taxPercent / 100));
      const totalNet = taxInclusive ? afterDiscount : roundMoney(afterDiscount + taxAmount);
      const count = await tx.sale.count({ where: { tenantId: currentUser.tid } });
      const receiptNo = `INV-${String(count + 1).padStart(5, "0")}`;

      const sale = await tx.sale.create({
        data: {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          cashierSessionId: session.id,
          cashierId: currentUser.sub,
          customerId: body.customerId,
          receiptNo,
          soldAt: new Date(),
          subtotal,
          discountAmount: headerDiscount,
          taxAmount,
          totalNet,
          status: "COMPLETED",
          notes: body.notes,
          items: {
            create: prepared.map((item) => ({
              tenantId: currentUser.tid,
              productId: item.product.id,
              productNameSnapshot: item.product.name,
              quantity: item.qty,
              unitPrice: item.unitPrice,
              discountAmount: item.lineDiscount,
              lineTotal: item.lineTotal,
              cogsAmount: item.cogs,
              recipeSnapshot: item.recipeSnapshot ?? undefined,
            })),
          },
          payments: {
            create: {
              tenantId: currentUser.tid,
              method: body.paymentMethod,
              amount: totalNet,
            },
          },
        },
        include: { items: true, payments: true, customer: true },
      });

      for (const item of prepared) {
        if (item.product.productType === "SIMPLE" || item.product.productType === "INGREDIENT") {
          await applyStockMovement(tx, {
            tenantId: currentUser.tid,
            outletId: outlet.id,
            productId: item.product.id,
            qtyDelta: -item.qty,
            movementType: "SALE",
            referenceType: "SALE",
            referenceId: sale.id,
            userId: currentUser.sub,
            allowNegative: tenant.allowNegativeStock,
            unitCost: asNumber(item.product.avgCost),
          });
        } else {
          for (const recipe of item.product.recipeAsMenu) {
            await applyStockMovement(tx, {
              tenantId: currentUser.tid,
              outletId: outlet.id,
              productId: recipe.ingredientId,
              qtyDelta: -(asNumber(recipe.quantity) * item.qty),
              movementType: "SALE",
              referenceType: "SALE",
              referenceId: sale.id,
              userId: currentUser.sub,
              allowNegative: tenant.allowNegativeStock,
              unitCost: asNumber(recipe.ingredient.avgCost),
            });
          }
        }
      }

      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CREATE",
        module: "sales",
        entity: "sale",
        entityId: sale.id,
      });

      return this.toSale(sale);
    });
  }

  async cancelSale(currentUser: JwtPayload, id: string, body: z.infer<typeof saleCancelSchema>) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, tenantId: currentUser.tid },
        include: { items: true },
      });
      if (!sale) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      if (sale.status === "CANCELLED") {
        throw new AppError("VALIDATION_ERROR", "Penjualan sudah dibatalkan.", 400);
      }

      const movements = await tx.stockMovement.findMany({
        where: { tenantId: currentUser.tid, referenceType: "SALE", referenceId: sale.id, movementType: "SALE" },
      });
      for (const movement of movements) {
        await applyStockMovement(tx, {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          productId: movement.productId,
          qtyDelta: -asNumber(movement.quantity),
          movementType: "SALE",
          referenceType: "SALE_CANCEL",
          referenceId: sale.id,
          userId: currentUser.sub,
          allowNegative: true,
        });
      }

      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: currentUser.sub,
          notes: body.reason,
        },
        include: { items: true, payments: true, customer: true },
      });
      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CANCEL",
        module: "sales",
        entity: "sale",
        entityId: sale.id,
        newValue: { reason: body.reason },
      });
      return this.toSale(updated);
    });
  }

  private async summarizeSession(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sessionId: string,
    openingCash: unknown,
    closingCash: number,
  ) {
    const sales = await tx.sale.findMany({
      where: {
        tenantId,
        cashierSessionId: sessionId,
        status: { not: "CANCELLED" },
      },
      select: {
        totalNet: true,
        payments: {
          select: {
            method: true,
            amount: true,
          },
        },
      },
    });

    const salesCount = sales.length;
    const salesTotal = roundMoney(sales.reduce((sum, sale) => sum + asNumber(sale.totalNet), 0));
    const cashSalesTotal = roundMoney(
      sales.reduce((sum, sale) => {
        const hasCashPayment = sale.payments.some((payment) => payment.method === "CASH");
        return hasCashPayment ? sum + asNumber(sale.totalNet) : sum;
      }, 0),
    );
    const expectedCash = roundMoney(asNumber(openingCash) + cashSalesTotal);
    const cashDifference = roundMoney(closingCash - expectedCash);

    return {
      salesCount,
      salesTotal,
      cashSalesTotal,
      expectedCash,
      cashDifference,
    };
  }

  private toSale(row: {
    id: string;
    receiptNo: string;
    soldAt: Date;
    subtotal: unknown;
    discountAmount: unknown;
    taxAmount: unknown;
    totalNet: unknown;
    status: string;
    notes: string | null;
    customer: { id: string; name: string } | null;
    items: Array<{
      productId: string;
      productNameSnapshot: string;
      quantity: unknown;
      unitPrice: unknown;
      lineTotal: unknown;
      cogsAmount: unknown;
    }>;
    payments: Array<{ method: string; amount: unknown }>;
  }) {
    return {
      id: row.id,
      receiptNo: row.receiptNo,
      soldAt: row.soldAt.toISOString(),
      subtotal: asNumber(row.subtotal),
      discountAmount: asNumber(row.discountAmount),
      taxAmount: asNumber(row.taxAmount),
      totalNet: asNumber(row.totalNet),
      status: row.status,
      notes: row.notes,
      customer: row.customer,
      items: row.items.map((item) => ({
        productId: item.productId,
        name: item.productNameSnapshot,
        quantity: asNumber(item.quantity),
        unitPrice: asNumber(item.unitPrice),
        lineTotal: asNumber(item.lineTotal),
        cogsAmount: asNumber(item.cogsAmount),
      })),
      payments: row.payments.map((item) => ({ method: item.method, amount: asNumber(item.amount) })),
    };
  }
}
