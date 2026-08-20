import { Inject, Injectable } from "@nestjs/common";
import type { purchaseSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber, roundMoney } from "../common/money.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { applyStockMovement } from "../inventory/inventory.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PurchasesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(currentUser: JwtPayload) {
    const rows = await this.prisma.purchase.findMany({
      where: { tenantId: currentUser.tid },
      include: { supplier: true, items: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toPurchase(row));
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

  async receive(currentUser: JwtPayload, id: string) {
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
        throw new AppError("VALIDATION_ERROR", "Pembelian sudah diterima.", 400);
      }
      if (purchase.documentStatus === "CANCELLED") {
        throw new AppError("VALIDATION_ERROR", "Pembelian sudah dibatalkan.", 400);
      }

      for (const item of purchase.items) {
        await applyStockMovement(tx, {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          productId: item.productId,
          qtyDelta: asNumber(item.quantity),
          movementType: "PURCHASE",
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          unitCost: asNumber(item.unitCost),
          userId: currentUser.sub,
          allowNegative: tenant.allowNegativeStock,
          updateAvgCost: { qtyAdded: asNumber(item.quantity), unitCost: asNumber(item.unitCost) },
        });
      }

      const updated = await tx.purchase.update({
        where: { id: purchase.id },
        data: { documentStatus: "RECEIVED", receivedAt: new Date() },
        include: { supplier: true, items: true },
      });
      return this.toPurchase(updated);
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
    items: Array<{ productId: string; quantity: unknown; unitCost: unknown; lineTotal: unknown }>;
  }) {
    return {
      id: row.id,
      invoiceNo: row.invoiceNo,
      purchasedAt: row.purchasedAt.toISOString(),
      totalAmount: asNumber(row.totalAmount),
      documentStatus: row.documentStatus,
      paymentStatus: row.paymentStatus,
      supplier: row.supplier,
      items: row.items.map((item) => ({
        productId: item.productId,
        quantity: asNumber(item.quantity),
        unitCost: asNumber(item.unitCost),
        lineTotal: asNumber(item.lineTotal),
      })),
    };
  }
}
