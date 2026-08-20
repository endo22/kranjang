import { Algorithm, hash as hashPassword, verify as verifyPassword } from "@node-rs/argon2";
import { Inject, Injectable } from "@nestjs/common";
import type { adminLoginSchema, adminPlanSchema, adminTenantStatusSchema } from "@kranjang/shared";
import type { z } from "zod";
import { AppError } from "../common/app-error.js";
import { asNumber } from "../common/money.js";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service.js";
import { ACCESS_TTL_SEC, type JwtPayload, signAccess } from "../auth/tokens.js";

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(body: z.infer<typeof adminLoginSchema>) {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email, deletedAt: null, isSuperAdmin: true },
    });
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      throw new AppError("UNAUTHORIZED", "Email atau password salah.", 401);
    }
    const payload: JwtPayload = { sub: user.id, tid: user.id, role: "SuperAdmin", perms: ["admin"] };
    return {
      accessToken: signAccess(this.jwt, payload),
      user: { id: user.id, name: user.name, email: user.email, role: "SuperAdmin" },
      expiresIn: ACCESS_TTL_SEC,
    };
  }

  async overview() {
    const [tenantCount, trial, active, expired, userCount, saleCount, payments] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({ where: { subscriptionStatus: "TRIAL", deletedAt: null } }),
      this.prisma.tenant.count({ where: { subscriptionStatus: "ACTIVE", deletedAt: null } }),
      this.prisma.tenant.count({ where: { subscriptionStatus: "EXPIRED", deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isSuperAdmin: false } }),
      this.prisma.sale.count({ where: { status: "COMPLETED" } }),
      this.prisma.payment.findMany(),
    ]);
    const paid = payments.filter((row) => row.status === "PAID");
    const failed = payments.filter((row) => row.status === "FAILED");
    return {
      tenants: { total: tenantCount, trial, active, expired },
      users: userCount,
      businessTransactions: saleCount,
      subscriptionRevenue: paid.reduce((sum, row) => sum + asNumber(row.amount), 0),
      payments: { success: paid.length, failed: failed.length },
    };
  }

  listTenants(q?: string) {
    return this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        subscriptionStatus: true,
        trialEndDate: true,
        email: true,
      },
    });
  }

  async updateTenantStatus(id: string, body: z.infer<typeof adminTenantStatusSchema>) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!tenant) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
    return this.prisma.tenant.update({
      where: { id },
      data: { subscriptionStatus: body.subscriptionStatus },
    });
  }

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: "asc" } });
  }

  async updatePlan(id: string, body: z.infer<typeof adminPlanSchema>) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: body.name,
        priceMonthly: body.priceMonthly,
        durationDays: body.durationDays,
        maxOutlets: body.maxOutlets,
        featureReports: body.featureReports,
        featureInventory: body.featureInventory,
        featureMultiOutlet: body.featureMultiOutlet,
        featureExport: body.featureExport,
        isActive: body.isActive ?? true,
      },
    });
  }

  listPayments() {
    return this.prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }

  listAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } },
    }).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        action: row.action,
        module: row.module,
        entity: row.entity,
        entityId: row.entityId,
        createdAt: row.createdAt.toISOString(),
        actor: row.user ? { name: row.user.name, email: row.user.email } : null,
      })),
    );
  }

  async ensureSeedAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@kranjang.local";
    const defaultPassword = "ChangeMeAdmin12";
    const password = process.env.SUPER_ADMIN_PASSWORD ?? defaultPassword;

    if (process.env.NODE_ENV === "production") {
      if (!process.env.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD === defaultPassword) {
        throw new Error(
          "SUPER_ADMIN_PASSWORD wajib di-set di production dan tidak boleh memakai default ChangeMeAdmin12.",
        );
      }
    }

    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        name: "Super Admin",
        email,
        passwordHash: await hashPassword(password, { algorithm: Algorithm.Argon2id }),
        isSuperAdmin: true,
      },
    });
  }
}
