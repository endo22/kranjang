import { Inject, Injectable, Logger } from "@nestjs/common";
import type { JwtPayload } from "../auth/tokens.js";
import { sendMail } from "../auth/mailer.js";
import { AppError } from "../common/app-error.js";
import { asNumber } from "../common/money.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DEBOUNCE_MS = 6 * 60 * 60 * 1000;

type SendResult = {
  sent: true;
  count: number;
  to: string[];
  delivered: boolean;
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async sendLowStockAlert(currentUser: JwtPayload) {
    return this.sendLowStockAlertForTenant(currentUser.tid, { throwOnSkip: true });
  }

  /** Dipakai cron harian: skip tenang jika debounce / kosong / tanpa owner. */
  async runScheduledLowStockAlerts() {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });

    let sent = 0;
    let skipped = 0;
    for (const tenant of tenants) {
      try {
        const result = await this.sendLowStockAlertForTenant(tenant.id, { throwOnSkip: false });
        if (result) {
          sent += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        skipped += 1;
        this.logger.warn(
          `Low-stock cron gagal untuk tenant ${tenant.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(`Low-stock cron selesai: ${sent} terkirim, ${skipped} dilewati, ${tenants.length} tenant.`);
    return { tenants: tenants.length, sent, skipped };
  }

  private async sendLowStockAlertForTenant(
    tenantId: string,
    options: { throwOnSkip: boolean },
  ): Promise<SendResult | null> {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      if (options.throwOnSkip) {
        throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
      }
      return null;
    }

    if (settings.lastLowStockAlertAt) {
      const elapsed = Date.now() - settings.lastLowStockAlertAt.getTime();
      if (elapsed < DEBOUNCE_MS) {
        if (options.throwOnSkip) {
          const hoursLeft = Math.ceil((DEBOUNCE_MS - elapsed) / 3_600_000);
          throw new AppError(
            "VALIDATION_ERROR",
            `Alert stok baru saja dikirim. Coba lagi dalam sekitar ${hoursLeft} jam.`,
            400,
          );
        }
        return null;
      }
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null, productType: { not: "RECIPE" } },
      orderBy: { name: "asc" },
    });
    const lowStock = products.filter((product) => asNumber(product.stock) <= asNumber(product.minStock));
    if (lowStock.length === 0) {
      if (options.throwOnSkip) {
        throw new AppError("VALIDATION_ERROR", "Tidak ada produk dengan stok menipis.", 400);
      }
      return null;
    }

    const owners = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        userRoles: { some: { role: { name: "Owner" } } },
      },
      select: { email: true, name: true },
    });
    const ownerEmails = owners.map((owner) => owner.email).filter(Boolean);
    if (ownerEmails.length === 0 && !process.env.MAIL_TO_OVERRIDE) {
      if (options.throwOnSkip) {
        throw new AppError("VALIDATION_ERROR", "Tidak ada email Owner untuk dikirimi alert.", 400);
      }
      return null;
    }

    const lines = lowStock.map(
      (product) => `- ${product.name}: stok ${asNumber(product.stock)} (min ${asNumber(product.minStock)})`,
    );
    const text = [
      "Alert stok menipis Kranjang",
      "",
      `Ada ${lowStock.length} produk di bawah atau sama dengan minimum stok:`,
      ...lines,
      "",
      "Silakan cek menu Inventori di aplikasi.",
    ].join("\n");

    const result = await sendMail({
      to: ownerEmails,
      subject: `Kranjang: ${lowStock.length} produk stok menipis`,
      text,
    });

    await this.prisma.tenantSettings.update({
      where: { tenantId },
      data: { lastLowStockAlertAt: new Date() },
    });

    return {
      sent: true,
      count: lowStock.length,
      to: result.to,
      delivered: result.delivered,
    };
  }
}
