import { Inject, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../auth/tokens.js";
import { sendMail } from "../auth/mailer.js";
import { AppError } from "../common/app-error.js";
import { asNumber } from "../common/money.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DEBOUNCE_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class AlertsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async sendLowStockAlert(currentUser: JwtPayload) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId: currentUser.tid } });
    if (!settings) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }

    if (settings.lastLowStockAlertAt) {
      const elapsed = Date.now() - settings.lastLowStockAlertAt.getTime();
      if (elapsed < DEBOUNCE_MS) {
        const hoursLeft = Math.ceil((DEBOUNCE_MS - elapsed) / 3_600_000);
        throw new AppError(
          "VALIDATION_ERROR",
          `Alert stok baru saja dikirim. Coba lagi dalam sekitar ${hoursLeft} jam.`,
          400,
        );
      }
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId: currentUser.tid, deletedAt: null, productType: { not: "RECIPE" } },
      orderBy: { name: "asc" },
    });
    const lowStock = products.filter((product) => asNumber(product.stock) <= asNumber(product.minStock));
    if (lowStock.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Tidak ada produk dengan stok menipis.", 400);
    }

    const owners = await this.prisma.user.findMany({
      where: {
        tenantId: currentUser.tid,
        deletedAt: null,
        userRoles: { some: { role: { name: "Owner" } } },
      },
      select: { email: true, name: true },
    });
    const ownerEmails = owners.map((owner) => owner.email).filter(Boolean);
    if (ownerEmails.length === 0 && !process.env.MAIL_TO_OVERRIDE) {
      throw new AppError("VALIDATION_ERROR", "Tidak ada email Owner untuk dikirimi alert.", 400);
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
      where: { tenantId: currentUser.tid },
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
