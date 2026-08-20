import { Inject, Injectable } from "@nestjs/common";
import type { expenseSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber } from "../common/money.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ExpensesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listCategories(currentUser: JwtPayload) {
    return this.prisma.expenseCategory.findMany({
      where: { tenantId: currentUser.tid },
      orderBy: { name: "asc" },
    });
  }

  async list(currentUser: JwtPayload) {
    const rows = await this.prisma.expense.findMany({
      where: { tenantId: currentUser.tid, deletedAt: null },
      include: { category: true },
      orderBy: { expenseDate: "desc" },
    });
    return rows.map((row) => this.toExpense(row));
  }

  async create(currentUser: JwtPayload, body: z.infer<typeof expenseSchema>) {
    const { tenant, outlet } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    const expense = await this.prisma.expense.create({
      data: {
        tenantId: currentUser.tid,
        outletId: outlet.id,
        categoryId: body.categoryId,
        description: body.description,
        amount: body.amount,
        expenseDate: new Date(body.expenseDate),
        paymentMethod: body.paymentMethod,
        attachmentPath: body.attachmentPath,
        createdById: currentUser.sub,
      },
      include: { category: true },
    });
    await writeAudit(this.prisma, {
      tenantId: currentUser.tid,
      userId: currentUser.sub,
      action: "CREATE",
      module: "expense",
      entity: "expense",
      entityId: expense.id,
    });
    return this.toExpense(expense);
  }

  async update(currentUser: JwtPayload, id: string, body: z.infer<typeof expenseSchema>) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireExpense(currentUser.tid, id);
    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        categoryId: body.categoryId,
        description: body.description,
        amount: body.amount,
        expenseDate: new Date(body.expenseDate),
        paymentMethod: body.paymentMethod,
        attachmentPath: body.attachmentPath,
      },
      include: { category: true },
    });
    return this.toExpense(expense);
  }

  async remove(currentUser: JwtPayload, id: string) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireExpense(currentUser.tid, id);
    await this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  private async requireExpense(tenantId: string, id: string) {
    const row = await this.prisma.expense.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!row) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return row;
  }

  private toExpense(row: {
    id: string;
    description: string;
    amount: unknown;
    expenseDate: Date;
    paymentMethod: string;
    category: { id: string; name: string };
  }) {
    return {
      id: row.id,
      description: row.description,
      amount: asNumber(row.amount),
      expenseDate: row.expenseDate.toISOString().slice(0, 10),
      paymentMethod: row.paymentMethod,
      category: row.category,
    };
  }
}
