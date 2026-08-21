import { Inject, Injectable } from "@nestjs/common";
import type { outletSchema, patchOutletSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { assertWritableSubscription, requireTenantOutlet, writeAudit } from "../common/tenant-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

type OutletBody = z.infer<typeof outletSchema>;
type PatchOutletBody = z.infer<typeof patchOutletSchema>;

@Injectable()
export class OutletsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(currentUser: JwtPayload) {
    const rows = await this.prisma.outlet.findMany({
      where: { tenantId: currentUser.tid, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return rows.map((row) => this.toOutlet(row));
  }

  async create(currentUser: JwtPayload, body: OutletBody) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    const plan = tenant.subscriptionPlan;
    const maxOutlets = plan?.maxOutlets ?? 1;
    const multi = plan?.featureMultiOutlet ?? false;
    const activeCount = await this.prisma.outlet.count({
      where: { tenantId: currentUser.tid, deletedAt: null },
    });

    if (!multi && activeCount >= 1) {
      throw new AppError("VALIDATION_ERROR", "Paket Anda belum mendukung multi-outlet.", 400);
    }
    if (activeCount >= maxOutlets) {
      throw new AppError("VALIDATION_ERROR", `Batas outlet paket tercapai (maksimal ${maxOutlets}).`, 400);
    }

    const outlet = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.outlet.updateMany({
          where: { tenantId: currentUser.tid, deletedAt: null },
          data: { isDefault: false },
        });
      }
      const created = await tx.outlet.create({
        data: {
          tenantId: currentUser.tid,
          name: body.name,
          address: body.address,
          isDefault: body.isDefault ?? activeCount === 0,
        },
      });
      await writeAudit(tx, {
        tenantId: currentUser.tid,
        userId: currentUser.sub,
        action: "CREATE",
        module: "settings",
        entity: "outlet",
        entityId: created.id,
      });
      return created;
    });

    return this.toOutlet(outlet);
  }

  async patch(currentUser: JwtPayload, id: string, body: PatchOutletBody) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    const existing = await this.prisma.outlet.findFirst({
      where: { id, tenantId: currentUser.tid, deletedAt: null },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Outlet tidak ditemukan.", 404);
    }

    const outlet = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.outlet.updateMany({
          where: { tenantId: currentUser.tid, deletedAt: null },
          data: { isDefault: false },
        });
      }
      return tx.outlet.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.address !== undefined ? { address: body.address } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        },
      });
    });

    return this.toOutlet(outlet);
  }

  async remove(currentUser: JwtPayload, id: string) {
    const { tenant } = await requireTenantOutlet(this.prisma, currentUser);
    assertWritableSubscription(tenant.subscriptionStatus);

    const existing = await this.prisma.outlet.findFirst({
      where: { id, tenantId: currentUser.tid, deletedAt: null },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Outlet tidak ditemukan.", 404);
    }
    if (existing.isDefault) {
      throw new AppError("VALIDATION_ERROR", "Outlet default tidak bisa dihapus. Jadikan outlet lain sebagai default dulu.", 400);
    }

    const activeCount = await this.prisma.outlet.count({
      where: { tenantId: currentUser.tid, deletedAt: null },
    });
    if (activeCount <= 1) {
      throw new AppError("VALIDATION_ERROR", "Minimal satu outlet harus tetap aktif.", 400);
    }

    await this.prisma.outlet.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  private toOutlet(row: { id: string; name: string; address: string | null; isDefault: boolean }) {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      isDefault: row.isDefault,
    };
  }
}
