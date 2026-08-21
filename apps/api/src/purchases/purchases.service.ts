import { Inject, Injectable } from "@nestjs/common";
import type { purchaseReceiveSchema, purchaseReturnSchema, purchaseSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber, roundMoney, roundQty } from "../common/money.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { applyStockMovement } from "../inventory/inventory.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

type ReceiveBody = z.infer<typeof purchaseReceiveSchema>;
type ReturnBody = z.infer<typeof purchaseReturnSchema>;

@Injectable()
export class PurchasesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(currentUser: JwtPayload, page: { limit?: number; offset?: number } = {}) {
    const where = { tenantId: currentUser.tid };
    const limit = page.limit ?? 50;
    const offset = page.offset ?? 0;
    const [total, rows] = await Promise.all([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.findMany({
        where,
        include: { supplier: true, items: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);
    return { items: rows.map((row) => this.toPurchase(row)), total };
  }

  async get(currentUser: JwtPayload, id: string) {
    const row = await this.prisma.purchase.findFirst({
      where: { id, tenantId: currentUser.tid },
      include: { supplier: true, items: { include: { product: true } } },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return this.toPurchase(row);
  }

  async create(currentUser: JwtPayload, body: z.infer<typeof purchaseSchema>) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    const itemsTotal = body.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const totalAmount = roundMoney(itemsTotal - (body.discountAmount ?? 0) + (body.taxAmount ?? 0));

    const purchase = await this.prisma.purchase.create({
      data: {
        tenantId: currentUser.tid,
        outletId: outlet.id,
        supplierId: body.supplierId,
        invoiceNo: body.invoiceNo,
        purchasedAt: new Date(body.purchasedAt),
        discountAmount: body.discountAmount ?? 0,
        taxAmount: body.taxAmount ?? 0,
        totalAmount,
        documentStatus: "DRAFT",
        paymentStatus: body.paymentStatus ?? "UNPAID",
        notes: body.notes,
        createdById: currentUser.sub,
        items: {
          create: body.items.map((item) => ({
            tenantId: currentUser.tid,
            productId: item.productId,
            quantity: item.quantity,
            receivedQty: 0,
            returnedQty: 0,
            unitCost: item.unitCost,
            lineTotal: roundMoney(item.quantity * item.unitCost),
          })),
        },
      },
      include: { supplier: true, items: true },
    });

    await writeAudit(this.prisma, {
      tenantId: currentUser.tid,
      userId: currentUser.sub,
      action: "CREATE",
      module: "purchase",
      entity: "purchase",
      entityId: purchase.id,
    });

    return this.toPurchase(purchase);
  }

  async receive(currentUser: JwtPayload, id: string, body: ReceiveBody = {}) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, tenantId: currentUser.tid },
        include: { items: true },
      });
      if (!purchase) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      if (purchase.documentStatus === "RECEIVED") {
        throw new AppError("VALIDATION_ERROR", "Pembelian sudah diterima penuh.", 400);
      }
      if (purchase.documentStatus === "CANCELLED") {
        throw new AppError("VALIDATION_ERROR", "Pembelian sudah dibatalkan.", 400);
      }
      if (purchase.documentStatus !== "DRAFT" && purchase.documentStatus !== "PARTIAL") {
        throw new AppError("VALIDATION_ERROR", "Status pembelian tidak bisa diterima.", 400);
      }

      const requested =
        body.items && body.items.length > 0
          ? body.items
          : purchase.items
              .map((item) => {
                const remaining = roundQty(asNumber(item.quantity) - asNumber(item.receivedQty));
                return remaining > 0 ? { purchaseItemId: item.id, quantity: remaining } : null;
              })
              .filter((row): row is { purchaseItemId: string; quantity: number } => row !== null);

      if (requested.length === 0) {
        throw new AppError("VALIDATION_ERROR", "Tidak ada qty tersisa untuk diterima.", 400);
      }

      const byId = new Map(purchase.items.map((item) => [item.id, item]));
      for (const line of requested) {
        const item = byId.get(line.purchaseItemId);
        if (!item || item.purchaseId !== purchase.id) {
          throw new AppError("VALIDATION_ERROR", "Baris pembelian tidak valid.", 400);
        }
        const remaining = roundQty(asNumber(item.quantity) - asNumber(item.receivedQty));
        if (line.quantity > remaining + 0.00001) {
          throw new AppError(
            "VALIDATION_ERROR",
            `Qty terima melebihi sisa (${remaining}) untuk salah satu baris.`,
            400,
          );
        }

        await applyStockMovement(tx, {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          productId: item.productId,
          qtyDelta: line.quantity,
          movementType: "PURCHASE",
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          unitCost: asNumber(item.unitCost),
          userId: currentUser.sub,
          allowNegative: tenant.allowNegativeStock,
          updateAvgCost: { qtyAdded: line.quantity, unitCost: asNumber(item.unitCost) },
        });

        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { receivedQty: roundQty(asNumber(item.receivedQty) + line.quantity) },
        });
      }

      const freshItems = await tx.purchaseItem.findMany({ where: { purchaseId: purchase.id } });
      const fullyReceived = freshItems.every(
        (item) => asNumber(item.receivedQty) + 0.00001 >= asNumber(item.quantity),
      );
      const updated = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          documentStatus: fullyReceived ? "RECEIVED" : "PARTIAL",
          receivedAt: purchase.receivedAt ?? new Date(),
        },
        include: { supplier: true, items: true },
      });
      return this.toPurchase(updated);
    });
  }

  async createReturn(currentUser: JwtPayload, id: string, body: ReturnBody) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, tenantId: currentUser.tid },
        include: { items: true },
      });
      if (!purchase) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      if (purchase.documentStatus !== "PARTIAL" && purchase.documentStatus !== "RECEIVED") {
        throw new AppError("VALIDATION_ERROR", "Retur hanya untuk pembelian yang sudah diterima (parsial/penuh).", 400);
      }

      const byId = new Map(purchase.items.map((item) => [item.id, item]));
      for (const line of body.items) {
        const item = byId.get(line.purchaseItemId);
        if (!item) {
          throw new AppError("VALIDATION_ERROR", "Baris pembelian tidak valid.", 400);
        }
        const returnable = roundQty(asNumber(item.receivedQty) - asNumber(item.returnedQty));
        if (line.quantity > returnable + 0.00001) {
          throw new AppError(
            "VALIDATION_ERROR",
            `Qty retur melebihi yang bisa dikembalikan (${returnable}).`,
            400,
          );
        }
      }

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          purchaseId: purchase.id,
          notes: body.notes,
          createdById: currentUser.sub,
          items: {
            create: body.items.map((line) => {
              const item = byId.get(line.purchaseItemId)!;
              return {
                tenantId: currentUser.tid,
                purchaseItemId: item.id,
                productId: item.productId,
                quantity: line.quantity,
                unitCost: item.unitCost,
              };
            }),
          },
        },
      });

      for (const line of body.items) {
        const item = byId.get(line.purchaseItemId)!;
        await applyStockMovement(tx, {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          productId: item.productId,
          qtyDelta: -line.quantity,
          movementType: "PURCHASE_RETURN",
          referenceType: "PURCHASE_RETURN",
          referenceId: purchaseReturn.id,
          unitCost: asNumber(item.unitCost),
          notes: body.notes,
          userId: currentUser.sub,
          allowNegative: tenant.allowNegativeStock,
        });
        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { returnedQty: roundQty(asNumber(item.returnedQty) + line.quantity) },
        });
      }

      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CREATE",
        module: "purchase",
        entity: "purchase_return",
        entityId: purchaseReturn.id,
      });

      const updated = await tx.purchase.findFirstOrThrow({
        where: { id: purchase.id },
        include: { supplier: true, items: true },
      });
      return {
        purchase: this.toPurchase(updated),
        returnId: purchaseReturn.id,
      };
    });
  }

  async cancelDraft(currentUser: JwtPayload, id: string) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId: currentUser.tid },
      include: { supplier: true, items: true },
    });
    if (!purchase) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    if (purchase.documentStatus !== "DRAFT") {
      throw new AppError("VALIDATION_ERROR", "Hanya draft yang bisa dibatalkan.", 400);
    }
    const updated = await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { documentStatus: "CANCELLED" },
      include: { supplier: true, items: true },
    });
    await writeAudit(this.prisma, {
      tenantId: currentUser.tid,
      userId: currentUser.sub,
      action: "CANCEL",
      module: "purchase",
      entity: "purchase",
      entityId: purchase.id,
    });
    return this.toPurchase(updated);
  }

  private toPurchase(row: {
    id: string;
    invoiceNo: string;
    purchasedAt: Date;
    totalAmount: unknown;
    documentStatus: string;
    paymentStatus: string;
    supplier?: { id: string; name: string } | null;
    items: Array<{
      id: string;
      productId: string;
      quantity: unknown;
      receivedQty?: unknown;
      returnedQty?: unknown;
      unitCost: unknown;
      lineTotal: unknown;
      product?: { name: string } | null;
    }>;
  }) {
    return {
      id: row.id,
      invoiceNo: row.invoiceNo,
      purchasedAt: row.purchasedAt.toISOString(),
      totalAmount: asNumber(row.totalAmount),
      documentStatus: row.documentStatus,
      paymentStatus: row.paymentStatus,
      supplier: row.supplier,
      items: row.items.map((item) => {
        const quantity = asNumber(item.quantity);
        const receivedQty = asNumber(item.receivedQty ?? 0);
        const returnedQty = asNumber(item.returnedQty ?? 0);
        return {
          id: item.id,
          productId: item.productId,
          productName: item.product?.name,
          quantity,
          receivedQty,
          returnedQty,
          remainingReceive: roundQty(Math.max(0, quantity - receivedQty)),
          remainingReturn: roundQty(Math.max(0, receivedQty - returnedQty)),
          unitCost: asNumber(item.unitCost),
          lineTotal: asNumber(item.lineTotal),
        };
      }),
    };
  }
}
