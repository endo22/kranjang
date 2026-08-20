import { Inject, Injectable } from "@nestjs/common";
import type { customerSchema, supplierSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PartnersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listSuppliers(currentUser: JwtPayload) {
    return this.prisma.supplier.findMany({
      where: { tenantId: currentUser.tid, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async createSupplier(currentUser: JwtPayload, body: z.infer<typeof supplierSchema>) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    const supplier = await this.prisma.supplier.create({
      data: { tenantId: currentUser.tid, name: body.name, phone: body.phone, address: body.address },
    });
    await writeAudit(this.prisma, {
      tenantId: currentUser.tid,
      userId: currentUser.sub,
      action: "CREATE",
      module: "purchase",
      entity: "supplier",
      entityId: supplier.id,
    });
    return supplier;
  }

  async updateSupplier(currentUser: JwtPayload, id: string, body: z.infer<typeof supplierSchema>) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireSupplier(currentUser.tid, id);
    return this.prisma.supplier.update({
      where: { id },
      data: { name: body.name, phone: body.phone, address: body.address },
    });
  }

  async deleteSupplier(currentUser: JwtPayload, id: string) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireSupplier(currentUser.tid, id);
    await this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  listCustomers(currentUser: JwtPayload) {
    return this.prisma.customer.findMany({
      where: { tenantId: currentUser.tid, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async createCustomer(currentUser: JwtPayload, body: z.infer<typeof customerSchema>) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    return this.prisma.customer.create({
      data: { tenantId: currentUser.tid, name: body.name, phone: body.phone },
    });
  }

  async updateCustomer(currentUser: JwtPayload, id: string, body: z.infer<typeof customerSchema>) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireCustomer(currentUser.tid, id);
    return this.prisma.customer.update({ where: { id }, data: { name: body.name, phone: body.phone } });
  }

  async deleteCustomer(currentUser: JwtPayload, id: string) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);
    await this.requireCustomer(currentUser.tid, id);
    await this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  private async requireSupplier(tenantId: string, id: string) {
    const row = await this.prisma.supplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!row) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return row;
  }

  private async requireCustomer(tenantId: string, id: string) {
    const row = await this.prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!row) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return row;
  }
}
