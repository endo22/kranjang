import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@kranjang/db";
import type {
  cashierCloseSchema,
  cashierOpenSchema,
  dateRangeQuerySchema,
  diningTableSchema,
  patchDiningTableSchema,
  saleCancelSchema,
  saleHoldCheckoutSchema,
  saleHoldSchema,
  saleSchema,
} from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber, roundMoney } from "../common/money.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { applyStockMovement } from "../inventory/inventory.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

type SaleLineInput = {
  productId: string;
  quantity: number;
  discountAmount?: number;
  unitPrice?: number;
};

type PaymentInput = {
  paymentMethod?: z.infer<typeof saleSchema>["paymentMethod"];
  payments?: Array<{ method: string; amount: number }>;
};

type DecimalLike = { toString(): string } | number | string;

@Injectable()
export class SalesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async currentSession(currentUser: JwtPayload) {
    return this.prisma.cashierSession.findFirst({
      where: { tenantId: currentUser.tid, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
  }

  async openSession(currentUser: JwtPayload, body: z.infer<typeof cashierOpenSchema>, preferredOutletId?: string) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
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

  async listSales(currentUser: JwtPayload, query: z.infer<typeof dateRangeQuerySchema> & { limit?: number; offset?: number } = {}) {
    const soldAt =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
          }
        : undefined;
    const where = {
      tenantId: currentUser.tid,
      ...(query.status ? { status: query.status } : {}),
      ...(soldAt ? { soldAt } : {}),
    };
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [total, rows] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: { items: true, payments: true, customer: true },
        orderBy: { soldAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);
    return { items: rows.map((row) => this.toSale(row)), total };
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

  async createSale(currentUser: JwtPayload, body: z.infer<typeof saleSchema>, preferredOutletId?: string) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);
    const session = await this.currentSession(currentUser);
    if (!session) {
      throw new AppError("VALIDATION_ERROR", "Buka sesi kasir terlebih dahulu.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      return this.createCompletedSaleInTx(tx, {
        currentUser,
        tenant,
        outletId: outlet.id,
        sessionId: session.id,
        lines: body.items,
        customerId: body.customerId ?? null,
        diningTableId: body.diningTableId ?? null,
        saleHoldId: null,
        discountAmount: body.discountAmount ?? 0,
        notes: body.notes ?? null,
        payments: body,
      });
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

  async listDiningTables(currentUser: JwtPayload, preferredOutletId?: string) {
    const { outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    const rows = await this.prisma.diningTable.findMany({
      where: { tenantId: currentUser.tid, outletId: outlet.id, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => this.toDiningTable(row));
  }

  async createDiningTable(
    currentUser: JwtPayload,
    body: z.infer<typeof diningTableSchema>,
    preferredOutletId?: string,
  ) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);

    try {
      const created = await this.prisma.diningTable.create({
        data: {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          name: body.name,
          sortOrder: body.sortOrder ?? 0,
          isActive: body.isActive ?? true,
        },
      });
      await writeAudit(this.prisma, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CREATE",
        module: "sales",
        entity: "dining_table",
        entityId: created.id,
      });
      return this.toDiningTable(created);
    } catch (error) {
      this.rethrowUniqueDiningTable(error);
      throw error;
    }
  }

  async patchDiningTable(
    currentUser: JwtPayload,
    id: string,
    body: z.infer<typeof patchDiningTableSchema>,
    preferredOutletId?: string,
  ) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireDiningTable(currentUser.tid, outlet.id, id);

    try {
      const updated = await this.prisma.diningTable.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      await writeAudit(this.prisma, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "UPDATE",
        module: "sales",
        entity: "dining_table",
        entityId: updated.id,
      });
      return this.toDiningTable(updated);
    } catch (error) {
      this.rethrowUniqueDiningTable(error);
      throw error;
    }
  }

  async deleteDiningTable(currentUser: JwtPayload, id: string, preferredOutletId?: string) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireDiningTable(currentUser.tid, outlet.id, id);

    await this.prisma.diningTable.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await writeAudit(this.prisma, {
      tenantId: currentUser.tid,
      userId: currentUser.sub,
      action: "DELETE",
      module: "sales",
      entity: "dining_table",
      entityId: id,
    });
    return { success: true };
  }

  async listSaleHolds(currentUser: JwtPayload, status: string | undefined, preferredOutletId?: string) {
    const { outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    const rows = await this.prisma.saleHold.findMany({
      where: {
        tenantId: currentUser.tid,
        outletId: outlet.id,
        ...(status ? { status } : { status: "OPEN" }),
      },
      include: {
        items: true,
        customer: true,
        diningTable: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => this.toSaleHold(row));
  }

  async createSaleHold(currentUser: JwtPayload, body: z.infer<typeof saleHoldSchema>, preferredOutletId?: string) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);
    const session = await this.currentSession(currentUser);

    return this.prisma.$transaction(async (tx) => {
      const diningTableId = body.diningTableId ?? null;
      if (diningTableId) {
        await this.assertDiningTable(tx, currentUser.tid, outlet.id, diningTableId);
        await this.assertNoOpenHoldOnTable(tx, currentUser.tid, outlet.id, diningTableId);
      }

      const holdItems = await this.buildHoldItems(tx, currentUser.tid, body.items);
      const hold = await tx.saleHold.create({
        data: {
          tenantId: currentUser.tid,
          outletId: outlet.id,
          diningTableId,
          cashierSessionId: session?.id ?? null,
          cashierId: currentUser.sub,
          customerId: body.customerId ?? null,
          status: "OPEN",
          discountAmount: body.discountAmount ?? 0,
          notes: body.notes ?? null,
          items: {
            create: holdItems.map((item) => ({
              tenantId: currentUser.tid,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount,
            })),
          },
        },
        include: { items: true, customer: true, diningTable: true },
      });

      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CREATE",
        module: "sales",
        entity: "sale_hold",
        entityId: hold.id,
      });

      return this.toSaleHold(hold);
    });
  }

  async updateSaleHold(
    currentUser: JwtPayload,
    id: string,
    body: z.infer<typeof saleHoldSchema>,
    preferredOutletId?: string,
  ) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);

    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.saleHold.findFirst({
        where: { id, tenantId: currentUser.tid, outletId: outlet.id },
      });
      if (!hold) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      if (hold.status !== "OPEN") {
        throw new AppError("VALIDATION_ERROR", "Hold tidak dalam status OPEN.", 400);
      }

      const diningTableId = body.diningTableId ?? null;
      if (diningTableId) {
        await this.assertDiningTable(tx, currentUser.tid, outlet.id, diningTableId);
        await this.assertNoOpenHoldOnTable(tx, currentUser.tid, outlet.id, diningTableId, hold.id);
      }

      const holdItems = await this.buildHoldItems(tx, currentUser.tid, body.items);
      await tx.saleHoldItem.deleteMany({ where: { holdId: hold.id, tenantId: currentUser.tid } });
      const updated = await tx.saleHold.update({
        where: { id: hold.id },
        data: {
          diningTableId,
          customerId: body.customerId ?? null,
          discountAmount: body.discountAmount ?? 0,
          notes: body.notes ?? null,
          items: {
            create: holdItems.map((item) => ({
              tenantId: currentUser.tid,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount,
            })),
          },
        },
        include: { items: true, customer: true, diningTable: true },
      });

      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "UPDATE",
        module: "sales",
        entity: "sale_hold",
        entityId: updated.id,
      });

      return this.toSaleHold(updated);
    });
  }

  async cancelSaleHold(currentUser: JwtPayload, id: string, preferredOutletId?: string) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);

    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.saleHold.findFirst({
        where: { id, tenantId: currentUser.tid, outletId: outlet.id },
        include: { items: true, customer: true, diningTable: true },
      });
      if (!hold) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      if (hold.status !== "OPEN") {
        throw new AppError("VALIDATION_ERROR", "Hold tidak dalam status OPEN.", 400);
      }

      const updated = await tx.saleHold.update({
        where: { id: hold.id },
        data: { status: "CANCELLED" },
        include: { items: true, customer: true, diningTable: true },
      });

      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CANCEL",
        module: "sales",
        entity: "sale_hold",
        entityId: updated.id,
      });

      return this.toSaleHold(updated);
    });
  }

  async checkoutSaleHold(
    currentUser: JwtPayload,
    id: string,
    body: z.infer<typeof saleHoldCheckoutSchema>,
    preferredOutletId?: string,
  ) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser, preferredOutletId);
    assertWritableSubscription(tenant.subscriptionStatus);
    const session = await this.currentSession(currentUser);
    if (!session) {
      throw new AppError("VALIDATION_ERROR", "Buka sesi kasir terlebih dahulu.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.saleHold.findFirst({
        where: { id, tenantId: currentUser.tid, outletId: outlet.id },
        include: { items: true },
      });
      if (!hold) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      if (hold.status !== "OPEN") {
        throw new AppError("VALIDATION_ERROR", "Hold tidak dalam status OPEN.", 400);
      }
      if (hold.items.length === 0) {
        throw new AppError("VALIDATION_ERROR", "Hold tidak punya item.", 400);
      }

      const sale = await this.createCompletedSaleInTx(tx, {
        currentUser,
        tenant,
        outletId: outlet.id,
        sessionId: session.id,
        lines: hold.items.map((item) => ({
          productId: item.productId,
          quantity: asNumber(item.quantity),
          discountAmount: asNumber(item.discountAmount),
          unitPrice: asNumber(item.unitPrice),
        })),
        customerId: hold.customerId,
        diningTableId: hold.diningTableId,
        saleHoldId: hold.id,
        discountAmount: asNumber(hold.discountAmount),
        notes: hold.notes,
        payments: body,
      });

      await tx.saleHold.update({
        where: { id: hold.id },
        data: { status: "COMPLETED" },
      });

      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CHECKOUT",
        module: "sales",
        entity: "sale_hold",
        entityId: hold.id,
        newValue: { saleId: sale.id },
      });

      return sale;
    });
  }

  private async createCompletedSaleInTx(
    tx: Prisma.TransactionClient,
    input: {
      currentUser: JwtPayload;
      tenant: Awaited<ReturnType<typeof requireTenantOutlet>>["tenant"];
      outletId: string;
      sessionId: string;
      lines: SaleLineInput[];
      customerId: string | null;
      diningTableId: string | null;
      saleHoldId: string | null;
      discountAmount: number;
      notes: string | null;
      payments: PaymentInput;
    },
  ) {
    const { currentUser, tenant, outletId } = input;
    if (input.diningTableId) {
      await this.assertDiningTable(tx, currentUser.tid, outletId, input.diningTableId);
    }

    const settings = tenant.settings;
    const taxPercent = asNumber(settings?.taxPercent ?? 0);
    const taxInclusive = settings?.taxInclusive ?? true;

    const products = await tx.product.findMany({
      where: {
        id: { in: input.lines.map((item) => item.productId) },
        tenantId: currentUser.tid,
        deletedAt: null,
      },
      include: { recipeAsMenu: { include: { ingredient: true } } },
    });

    const prepared = [];
    for (const line of input.lines) {
      const product = products.find((row) => row.id === line.productId);
      if (!product || !product.isActive) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      if (product.productType === "RECIPE" && product.recipeAsMenu.length === 0) {
        throw new AppError("VALIDATION_ERROR", `${product.name} belum punya resep.`, 400);
      }

      const qty = line.quantity;
      const unitPrice = line.unitPrice !== undefined ? line.unitPrice : asNumber(product.sellPrice);
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
    const headerDiscount = input.discountAmount;
    const afterDiscount = roundMoney(Math.max(0, subtotal - headerDiscount));
    const taxAmount = taxInclusive
      ? roundMoney(afterDiscount - afterDiscount / (1 + taxPercent / 100))
      : roundMoney(afterDiscount * (taxPercent / 100));
    const totalNet = taxInclusive ? afterDiscount : roundMoney(afterDiscount + taxAmount);
    const paymentLines = this.normalizePayments(input.payments, totalNet);
    const count = await tx.sale.count({ where: { tenantId: currentUser.tid } });
    const receiptNo = `INV-${String(count + 1).padStart(5, "0")}`;

    const sale = await tx.sale.create({
      data: {
        tenantId: currentUser.tid,
        outletId,
        cashierSessionId: input.sessionId,
        cashierId: currentUser.sub,
        customerId: input.customerId,
        diningTableId: input.diningTableId,
        saleHoldId: input.saleHoldId,
        receiptNo,
        soldAt: new Date(),
        subtotal,
        discountAmount: headerDiscount,
        taxAmount,
        totalNet,
        status: "COMPLETED",
        notes: input.notes,
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
          create: paymentLines.map((payment) => ({
            tenantId: currentUser.tid,
            method: payment.method,
            amount: payment.amount,
          })),
        },
      },
      include: { items: true, payments: true, customer: true },
    });

    for (const item of prepared) {
      if (item.product.productType === "SIMPLE" || item.product.productType === "INGREDIENT") {
        await applyStockMovement(tx, {
          tenantId: currentUser.tid,
          outletId,
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
            outletId,
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
  }

  private normalizePayments(body: PaymentInput, totalNet: number): Array<{ method: string; amount: number }> {
    if (body.payments && body.payments.length > 0) {
      const sum = roundMoney(body.payments.reduce((acc, payment) => acc + payment.amount, 0));
      if (Math.abs(sum - totalNet) > 0.01) {
        throw new AppError("VALIDATION_ERROR", "Total pembayaran harus sama dengan total penjualan.", 400);
      }
      return body.payments.map((payment) => ({
        method: payment.method,
        amount: roundMoney(payment.amount),
      }));
    }
    if (!body.paymentMethod) {
      throw new AppError("VALIDATION_ERROR", "Metode pembayaran wajib diisi.", 400);
    }
    return [{ method: body.paymentMethod, amount: totalNet }];
  }

  private async buildHoldItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    items: Array<{ productId: string; quantity: number; discountAmount?: number }>,
  ) {
    const products = await tx.product.findMany({
      where: {
        id: { in: items.map((item) => item.productId) },
        tenantId,
        deletedAt: null,
      },
    });

    return items.map((line) => {
      const product = products.find((row) => row.id === line.productId);
      if (!product || !product.isActive) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      return {
        productId: product.id,
        quantity: line.quantity,
        unitPrice: asNumber(product.sellPrice),
        discountAmount: line.discountAmount ?? 0,
      };
    });
  }

  private async assertDiningTable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    outletId: string,
    diningTableId: string,
  ) {
    const table = await tx.diningTable.findFirst({
      where: { id: diningTableId, tenantId, outletId, deletedAt: null, isActive: true },
    });
    if (!table) {
      throw new AppError("NOT_FOUND", "Meja tidak ditemukan.", 404);
    }
    return table;
  }

  private async assertNoOpenHoldOnTable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    outletId: string,
    diningTableId: string,
    excludeHoldId?: string,
  ) {
    const existing = await tx.saleHold.findFirst({
      where: {
        tenantId,
        outletId,
        diningTableId,
        status: "OPEN",
        ...(excludeHoldId ? { id: { not: excludeHoldId } } : {}),
      },
    });
    if (existing) {
      throw new AppError("VALIDATION_ERROR", "Meja masih punya hold terbuka.", 400);
    }
  }

  private async requireDiningTable(tenantId: string, outletId: string, id: string) {
    const row = await this.prisma.diningTable.findFirst({
      where: { id, tenantId, outletId, deletedAt: null },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return row;
  }

  private rethrowUniqueDiningTable(error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new AppError("VALIDATION_ERROR", "Nama meja sudah dipakai di outlet ini.", 400);
    }
  }

  private async summarizeSession(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sessionId: string,
    openingCash: DecimalLike,
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
        const cashAmount = sale.payments
          .filter((payment) => payment.method === "CASH")
          .reduce((paymentSum, payment) => paymentSum + asNumber(payment.amount), 0);
        return sum + cashAmount;
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

  private toDiningTable(row: {
    id: string;
    outletId: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      outletId: row.outletId,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSaleHold(row: {
    id: string;
    status: string;
    diningTableId: string | null;
    customerId: string | null;
    discountAmount: DecimalLike;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    diningTable: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
    items: Array<{
      productId: string;
      quantity: DecimalLike;
      unitPrice: DecimalLike;
      discountAmount: DecimalLike;
    }>;
  }) {
    return {
      id: row.id,
      status: row.status,
      diningTableId: row.diningTableId,
      customerId: row.customerId,
      discountAmount: asNumber(row.discountAmount),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      diningTable: row.diningTable,
      customer: row.customer,
      items: row.items.map((item) => ({
        productId: item.productId,
        quantity: asNumber(item.quantity),
        unitPrice: asNumber(item.unitPrice),
        discountAmount: asNumber(item.discountAmount),
      })),
    };
  }

  private toSale(row: {
    id: string;
    receiptNo: string;
    soldAt: Date;
    subtotal: DecimalLike;
    discountAmount: DecimalLike;
    taxAmount: DecimalLike;
    totalNet: DecimalLike;
    status: string;
    notes: string | null;
    customer: { id: string; name: string } | null;
    items: Array<{
      productId: string;
      productNameSnapshot: string;
      quantity: DecimalLike;
      unitPrice: DecimalLike;
      lineTotal: DecimalLike;
      cogsAmount: DecimalLike;
    }>;
    payments: Array<{ method: string; amount: DecimalLike }>;
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
