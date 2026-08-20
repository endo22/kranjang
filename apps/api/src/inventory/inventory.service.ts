import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@kranjang/db";
import type { inventoryAdjustSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber, roundQty } from "../common/money.js";
import { assertWritableSubscription, requireTenantOutlet } from "../common/tenant-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

type Tx = Prisma.TransactionClient;

export async function applyStockMovement(
  tx: Tx,
  input: {
    tenantId: string;
    outletId: string;
    productId: string;
    qtyDelta: number;
    movementType: string;
    referenceType?: string;
    referenceId?: string;
    unitCost?: number;
    notes?: string | null;
    userId: string;
    allowNegative: boolean;
    updateAvgCost?: { qtyAdded: number; unitCost: number };
  },
) {
  const product = await tx.product.findFirst({
    where: { id: input.productId, tenantId: input.tenantId, deletedAt: null },
  });
  if (!product) {
    throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
  }

  const stockBefore = asNumber(product.stock);
  const stockAfter = roundQty(stockBefore + input.qtyDelta);
  if (stockAfter < -0.00001 && !input.allowNegative) {
    throw new AppError("STOCK_INSUFFICIENT", `Stok ${product.name} tidak cukup`, 400, {
      productId: product.id,
      available: stockBefore,
      required: Math.abs(input.qtyDelta),
    });
  }

  let avgCost = asNumber(product.avgCost);
  if (input.updateAvgCost && input.updateAvgCost.qtyAdded > 0) {
    const newQty = stockBefore + input.updateAvgCost.qtyAdded;
    avgCost =
      newQty <= 0
        ? avgCost
        : (stockBefore * avgCost + input.updateAvgCost.qtyAdded * input.updateAvgCost.unitCost) / newQty;
  }

  await tx.product.update({
    where: { id: product.id },
    data: { stock: stockAfter, avgCost },
  });

  await tx.stockMovement.create({
    data: {
      tenantId: input.tenantId,
      outletId: input.outletId,
      productId: product.id,
      movementType: input.movementType,
      quantity: input.qtyDelta,
      stockBefore,
      stockAfter,
      unitCost: input.unitCost,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes,
      createdById: input.userId,
    },
  });

  return { product, stockBefore, stockAfter, avgCost };
}

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async movements(
    currentUser: JwtPayload,
    query: { from?: string; to?: string; productId?: string; limit?: number; offset?: number },
  ) {
    const where: Prisma.StockMovementWhereInput = { tenantId: currentUser.tid };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [total, rows] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        productName: row.product.name,
        movementType: row.movementType,
        quantity: asNumber(row.quantity),
        stockBefore: asNumber(row.stockBefore),
        stockAfter: asNumber(row.stockAfter),
        createdAt: row.createdAt.toISOString(),
        notes: row.notes,
      })),
      total,
    };
  }

  async adjust(currentUser: JwtPayload, body: z.infer<typeof inventoryAdjustSchema>) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    return this.prisma.$transaction(async (tx) => {
      const result = await applyStockMovement(tx, {
        tenantId: currentUser.tid,
        outletId: outlet.id,
        productId: body.productId,
        qtyDelta: body.quantity,
        movementType: body.movementType,
        referenceType: "ADJUSTMENT",
        userId: currentUser.sub,
        allowNegative: tenant.allowNegativeStock,
        notes: body.notes,
        unitCost: body.movementType === "INITIAL_STOCK" ? undefined : undefined,
      });
      return { success: true, stockAfter: result.stockAfter };
    });
  }
}
