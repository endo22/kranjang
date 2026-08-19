import { Injectable } from "@nestjs/common";
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
  constructor(private readonly prisma: PrismaService) {}

  async get(currentUser: JwtPayload) {
    return this.toSettingsResponse(await this.getScopedTenant(currentUser.tid));
  }

  async patch(currentUser: JwtPayload, body: PatchSettingsBody) {
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: currentUser.tid },
        data: {
          name: body.name,
          phone: body.phone,
          timezone: body.timezone,
          allowNegativeStock: body.allowNegativeStock,
        },
      });

      await tx.tenantSettings.update({
        where: { tenantId: currentUser.tid },
        data: {
          taxPercent: body.taxPercent,
          taxInclusive: body.taxInclusive,
          receiptFooter: body.receiptFooter,
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
      trialEndDate: tenant.trialEndDate.toISOString(),
      subscriptionStatus: tenant.subscriptionStatus,
    };
  }
}
