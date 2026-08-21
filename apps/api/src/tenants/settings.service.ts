import { Inject, Injectable } from "@nestjs/common";
import { patchSettingsSchema } from "@kranjang/shared";
import type { Prisma } from "@kranjang/db";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { PrismaService } from "../prisma/prisma.service.js";

type PatchSettingsBody = z.infer<typeof patchSettingsSchema>;
type TenantWithSettings = Prisma.TenantGetPayload<{
  include: { settings: true };
}>;

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(currentUser: JwtPayload) {
    return this.toSettingsResponse(await this.getScopedTenant(currentUser.tid));
  }

  async patch(currentUser: JwtPayload, body: PatchSettingsBody) {
    const current = await this.getScopedTenant(currentUser.tid);
    const nextAudit = {
      name: body.name !== undefined ? body.name : current.name,
      phone: body.phone !== undefined ? body.phone : current.phone,
      timezone: body.timezone !== undefined ? body.timezone : current.timezone,
      allowNegativeStock:
        body.allowNegativeStock !== undefined ? body.allowNegativeStock : current.allowNegativeStock,
      taxPercent: body.taxPercent !== undefined ? body.taxPercent : Number(current.settings.taxPercent),
      taxInclusive: body.taxInclusive !== undefined ? body.taxInclusive : current.settings.taxInclusive,
      receiptFooter: body.receiptFooter !== undefined ? body.receiptFooter : current.settings.receiptFooter,
      receiptLogoUrl: body.receiptLogoUrl !== undefined ? body.receiptLogoUrl : current.settings.receiptLogoUrl,
      receiptQrPayload:
        body.receiptQrPayload !== undefined ? body.receiptQrPayload || null : current.settings.receiptQrPayload,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: currentUser.tid },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.allowNegativeStock !== undefined ? { allowNegativeStock: body.allowNegativeStock } : {}),
        },
      });

      await tx.tenantSettings.update({
        where: { tenantId: currentUser.tid },
        data: {
          ...(body.taxPercent !== undefined ? { taxPercent: body.taxPercent } : {}),
          ...(body.taxInclusive !== undefined ? { taxInclusive: body.taxInclusive } : {}),
          ...(body.receiptFooter !== undefined ? { receiptFooter: body.receiptFooter } : {}),
          ...(body.receiptLogoUrl !== undefined ? { receiptLogoUrl: body.receiptLogoUrl } : {}),
          ...(body.receiptQrPayload !== undefined ? { receiptQrPayload: body.receiptQrPayload || null } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: currentUser.tid,
          userId: currentUser.sub,
          action: "UPDATE",
          module: "settings",
          entity: "tenant",
          entityId: currentUser.tid,
          oldValue: this.toAuditSettingsSnapshot(current),
          newValue: nextAudit,
        },
      });
    });

    return this.toSettingsResponse(await this.getScopedTenant(currentUser.tid));
  }

  private async getScopedTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        deletedAt: null,
      },
      include: {
        settings: true,
      },
    });

    if (!tenant || !tenant.settings) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }

    return tenant;
  }

  private toSettingsResponse(tenant: TenantWithSettings) {
    return {
      name: tenant.name,
      phone: tenant.phone,
      timezone: tenant.timezone,
      allowNegativeStock: tenant.allowNegativeStock,
      taxPercent: tenant.settings.taxPercent.toString(),
      taxInclusive: tenant.settings.taxInclusive,
      receiptFooter: tenant.settings.receiptFooter,
      receiptLogoUrl: tenant.settings.receiptLogoUrl,
      receiptQrPayload: tenant.settings.receiptQrPayload,
      trialEndDate: tenant.trialEndDate.toISOString(),
      subscriptionStatus: tenant.subscriptionStatus,
    };
  }

  private toAuditSettingsSnapshot(tenant: TenantWithSettings) {
    return {
      name: tenant.name,
      phone: tenant.phone,
      timezone: tenant.timezone,
      allowNegativeStock: tenant.allowNegativeStock,
      taxPercent: Number(tenant.settings.taxPercent),
      taxInclusive: tenant.settings.taxInclusive,
      receiptFooter: tenant.settings.receiptFooter,
      receiptLogoUrl: tenant.settings.receiptLogoUrl,
      receiptQrPayload: tenant.settings.receiptQrPayload,
    };
  }
}
