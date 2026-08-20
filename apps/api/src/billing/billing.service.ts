import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { checkoutSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { asNumber } from "../common/money.js";
import { PrismaService } from "../prisma/prisma.service.js";

const memoryJobs = new Map<string, number>();

function midtransSnapBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

export async function createMidtransSnapToken(input: {
  orderId: string;
  amount: number;
  serverKey: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchFn = input.fetchImpl ?? fetch;
  const auth = Buffer.from(`${input.serverKey}:`).toString("base64");
  const response = await fetchFn(`${midtransSnapBaseUrl()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: Math.round(input.amount),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AppError("VALIDATION_ERROR", `Gagal membuat token Midtrans Snap.${text ? ` ${text.slice(0, 120)}` : ""}`, 400);
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new AppError("VALIDATION_ERROR", "Respons Midtrans Snap tidak berisi token.", 400);
  }
  return payload.token;
}

@Injectable()
export class BillingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrent(currentUser: JwtPayload) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: currentUser.tid },
      include: { subscriptionPlan: true, subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { payments: true } } },
    });
    if (!tenant) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return {
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndDate: tenant.trialEndDate.toISOString(),
      plan: tenant.subscriptionPlan,
      latest: tenant.subscriptions[0]
        ? {
            id: tenant.subscriptions[0].id,
            status: tenant.subscriptions[0].status,
            billingCycle: tenant.subscriptions[0].billingCycle,
            currentPeriodEnd: tenant.subscriptions[0].currentPeriodEnd.toISOString(),
            payments: tenant.subscriptions[0].payments.map((payment) => ({
              orderId: payment.orderId,
              status: payment.status,
              amount: asNumber(payment.amount),
            })),
          }
        : null,
    };
  }

  async checkout(currentUser: JwtPayload, body: z.infer<typeof checkoutSchema>) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code: body.planCode } });
    if (!plan || !plan.isActive) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: currentUser.tid },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }

    const amount = body.billingCycle === "annual" ? asNumber(plan.priceMonthly) * 12 : asNumber(plan.priceMonthly);
    const orderId = `KRJ-${randomUUID()}`;
    await this.prisma.payment.create({
      data: {
        tenantId: currentUser.tid,
        subscriptionId: subscription.id,
        orderId,
        amount,
        status: "PENDING",
        expiredAt: new Date(Date.now() + 24 * 3600_000),
      },
    });

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { pendingPlanId: plan.id, billingCycle: body.billingCycle === "annual" ? "ANNUAL" : "MONTHLY" },
    });

    const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
    const clientKey = process.env.MIDTRANS_CLIENT_KEY?.trim() || null;
    let snapToken: string | null = null;
    if (serverKey) {
      snapToken = await createMidtransSnapToken({ orderId, amount, serverKey });
    }

    return {
      orderId,
      snapToken,
      clientKey,
      redirectUrl: `${process.env.WEB_URL ?? "http://localhost:3000"}/app/subscription?orderId=${orderId}`,
      amount,
    };
  }

  async mockPay(orderId: string) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("FORBIDDEN", "Akses ditolak", 403);
    }
    return this.settle(orderId, "SETTLEMENT");
  }

  async webhook(body: {
    order_id?: string;
    transaction_status?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
  }) {
    const orderId = body.order_id ?? "";
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (serverKey && body.signature_key) {
      const expected = createHash("sha512")
        .update(`${orderId}${body.status_code ?? ""}${body.gross_amount ?? ""}${serverKey}`)
        .digest("hex");
      if (expected !== body.signature_key) {
        throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
      }
    }
    return this.settle(orderId, body.transaction_status ?? "settlement");
  }

  async cancel(currentUser: JwtPayload) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: currentUser.tid } });
    if (!tenant) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: "CANCELLED" },
    });
    return { success: true };
  }

  runBillingSweep() {
    const key = "billing-sweep";
    const last = memoryJobs.get(key) ?? 0;
    if (Date.now() - last < 60_000) {
      return { skipped: true };
    }
    memoryJobs.set(key, Date.now());
    void this.expireTrials();
    return { ok: true };
  }

  private async expireTrials() {
    const now = new Date();
    const graceMs = 3 * 24 * 3600_000;
    const tenants = await this.prisma.tenant.findMany({ where: { deletedAt: null } });
    for (const tenant of tenants) {
      if (tenant.subscriptionStatus === "TRIAL" && tenant.trialEndDate < now) {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { subscriptionStatus: "GRACE_PERIOD" },
        });
      } else if (tenant.subscriptionStatus === "GRACE_PERIOD" && now.getTime() - tenant.trialEndDate.getTime() > graceMs) {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { subscriptionStatus: "EXPIRED" },
        });
      }
    }
  }

  private async settle(orderId: string, status: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { subscription: true },
    });
    if (!payment) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    if (payment.status === "PAID") {
      return { success: true, duplicate: true };
    }

    const normalized = status.toLowerCase();
    if (!["settlement", "capture", "success", "paid"].includes(normalized)) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rawResponse: { status } } });
      return { success: false };
    }

    const periodDays = payment.subscription.billingCycle === "ANNUAL" ? 365 : 30;
    const start = new Date();
    const end = new Date(start.getTime() + periodDays * 86400000);
    const planId = payment.subscription.pendingPlanId ?? payment.subscription.planId;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: start, transactionId: orderId },
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: "ACTIVE",
          planId,
          pendingPlanId: null,
          currentPeriodStart: start,
          currentPeriodEnd: end,
        },
      }),
      this.prisma.tenant.update({
        where: { id: payment.tenantId },
        data: { subscriptionStatus: "ACTIVE", paymentStatus: "PAID", subscriptionPlanId: planId },
      }),
    ]);

    return { success: true };
  }
}
