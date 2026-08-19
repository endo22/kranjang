import { Algorithm, hash as hashPassword, verify as verifyPassword } from "@node-rs/argon2";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import { EXPENSE_CATEGORY_NAMES, LoginBody, RegisterBody } from "@kranjang/shared";
import { AppError } from "../common/app-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { sendDevLink } from "./mailer.js";
import { assertLoginAllowed, recordLoginFailure, resetLoginFailures } from "./rate-limit.js";
import { AuthResult } from "./auth.types.js";
import { hashToken, JwtPayload, newRefreshPlain, REFRESH_TTL_MS, signAccess } from "./tokens.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const REGISTER_SLUG_RETRY_LIMIT = 5;
const LOGIN_FAILURE_MESSAGE = "Email atau password salah.";
const SUPER_ADMIN_LOGIN_MESSAGE = "Akun platform tidak dapat masuk ke aplikasi tenant pada fase ini.";
const DUMMY_LOGIN_PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$Cx04jijWB8xQpWHnmgmKWg$DjIU0S3ystmcXpGRtrQQH6iLavrYg5Nt8dJwbehEVdQ";

type SessionUser = {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  passwordHash: string;
  isSuperAdmin: boolean;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    subscriptionStatus: string;
    trialEndDate: Date;
  } | null;
  userRoles: Array<{
    role: {
      name: string;
      permissions: Array<{
        permission: {
          code: string;
        };
      }>;
    };
  }>;
};

const sessionUserInclude = {
  tenant: true,
  userRoles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
} as const;

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || `tenant-${randomBytes(3).toString("hex")}`;
}

function isPrismaUniqueError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function getPrismaUniqueTargets(error: unknown): string[] {
  if (!error || typeof error !== "object" || !("meta" in error) || !error.meta || typeof error.meta !== "object") {
    return [];
  }

  const target = "target" in error.meta ? error.meta.target : undefined;
  if (Array.isArray(target)) {
    return target.filter((value): value is string => typeof value === "string");
  }

  if (typeof target === "string") {
    return [target];
  }

  return [];
}

function hasUniqueTarget(error: unknown, field: string): boolean {
  return getPrismaUniqueTargets(error).includes(field);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(body: RegisterBody): Promise<AuthResult> {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: body.email, deletedAt: null },
    });

    if (existingUser) {
      throw new AppError("CONFLICT", "Email sudah terpakai", 409);
    }

    const passwordHash = await hashPassword(body.password, {
      algorithm: Algorithm.Argon2id,
    });
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 30 * DAY_MS);
    const verifyPlain = randomBytes(32).toString("hex");
    const refreshPlain = newRefreshPlain();
    const verifyExpiresAt = new Date(now.getTime() + DAY_MS);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);

    const trialPlan = await this.prisma.subscriptionPlan.findUnique({ where: { code: "trial" } });
    if (!trialPlan) {
      throw new AppError("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.", 500);
    }

    const templateRoles = await this.prisma.role.findMany({
      where: { tenantId: null },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    for (let attempt = 0; attempt < REGISTER_SLUG_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const tenantSlug = await this.getUniqueSlug(tx, body.businessName);
          const tenant = await tx.tenant.create({
            data: {
              name: body.businessName,
              slug: tenantSlug,
              phone: body.phone,
              email: body.email,
              trialStartDate: now,
              trialEndDate,
              subscriptionStatus: "TRIAL",
              paymentStatus: "NONE",
              subscriptionPlanId: trialPlan.id,
            },
          });

          await tx.tenantSettings.create({
            data: {
              tenantId: tenant.id,
            },
          });

          const roles = new Map<string, { id: string; permissions: string[] }>();
          for (const templateRole of templateRoles) {
            const role = await tx.role.create({
              data: {
                tenantId: tenant.id,
                name: templateRole.name,
                isSystem: true,
                permissions: {
                  create: templateRole.permissions.map((item) => ({
                    permissionId: item.permissionId,
                  })),
                },
              },
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            });

            roles.set(role.name, {
              id: role.id,
              permissions: role.permissions.map((item) => item.permission.code),
            });
          }

          const ownerRole = roles.get("Owner");
          if (!ownerRole) {
            throw new AppError("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.", 500);
          }

          const user = await tx.user.create({
            data: {
              tenantId: tenant.id,
              name: body.ownerName,
              email: body.email,
              passwordHash,
              phone: body.phone,
            },
          });

          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: ownerRole.id,
            },
          });

          await tx.outlet.create({
            data: {
              tenantId: tenant.id,
              name: "Outlet Utama",
              isDefault: true,
            },
          });

          await tx.expenseCategory.createMany({
            data: EXPENSE_CATEGORY_NAMES.map((name) => ({
              tenantId: tenant.id,
              name,
              isSystem: true,
            })),
          });

          await tx.subscription.create({
            data: {
              tenantId: tenant.id,
              planId: trialPlan.id,
              status: "TRIAL",
              billingCycle: "TRIAL",
              currentPeriodStart: now,
              currentPeriodEnd: trialEndDate,
            },
          });

          await tx.auditLog.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              action: "CREATE",
              module: "tenant",
              entity: "tenant",
              entityId: tenant.id,
              newValue: {
                tenantId: tenant.id,
                slug: tenant.slug,
              },
            },
          });

          await tx.emailVerificationToken.create({
            data: {
              userId: user.id,
              tokenHash: hashToken(verifyPlain),
              expiresAt: verifyExpiresAt,
            },
          });

          await tx.refreshToken.create({
            data: {
              userId: user.id,
              tokenHash: hashToken(refreshPlain),
              expiresAt: refreshExpiresAt,
            },
          });

          const payload: JwtPayload = {
            sub: user.id,
            tid: tenant.id,
            role: "Owner",
            perms: ownerRole.permissions,
          };

          return {
            accessToken: signAccess(this.jwt, payload),
            user,
            tenant,
            ownerRole,
          };
        });

        const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
        sendDevLink("verify", `${webUrl}/verify-email?token=${verifyPlain}`);

        return {
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: "Owner",
            permissions: result.ownerRole.permissions,
            emailVerifiedAt: result.user.emailVerifiedAt ? result.user.emailVerifiedAt.toISOString() : null,
          },
          tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            slug: result.tenant.slug,
            subscriptionStatus: result.tenant.subscriptionStatus,
            trialEndDate: result.tenant.trialEndDate.toISOString(),
          },
          accessToken: result.accessToken,
          refreshPlain,
        };
      } catch (error) {
        if (isPrismaUniqueError(error) && hasUniqueTarget(error, "email")) {
          throw new AppError("CONFLICT", "Email sudah terpakai", 409);
        }

        if (isPrismaUniqueError(error) && hasUniqueTarget(error, "slug") && attempt < REGISTER_SLUG_RETRY_LIMIT - 1) {
          continue;
        }

        throw error;
      }
    }

    throw new AppError("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.", 500);
  }

  async login(body: LoginBody): Promise<AuthResult> {
    assertLoginAllowed(body.email);

    const user = (await this.prisma.user.findFirst({
      where: {
        email: body.email,
        deletedAt: null,
      },
      include: sessionUserInclude,
    })) as SessionUser | null;
    const passwordMatches = await verifyPassword(user?.passwordHash ?? DUMMY_LOGIN_PASSWORD_HASH, body.password);

    if (!user || !passwordMatches) {
      recordLoginFailure(body.email);
      throw new AppError("UNAUTHORIZED", LOGIN_FAILURE_MESSAGE, 401);
    }

    if (user.isSuperAdmin || user.tenantId === null) {
      throw new AppError("FORBIDDEN", SUPER_ADMIN_LOGIN_MESSAGE, 403);
    }

    const session = this.toSessionContext(user);
    const now = new Date();
    const refreshPlain = newRefreshPlain();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshPlain),
          expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: "LOGIN",
          module: "auth",
          entity: "session",
          entityId: user.id,
        },
      });
    });

    resetLoginFailures(body.email);

    return {
      ...session,
      accessToken: signAccess(this.jwt, session.payload),
      refreshPlain,
    };
  }

  async refresh(refreshPlain: string | undefined): Promise<AuthResult> {
    if (!refreshPlain) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    const now = new Date();
    const rotated = await this.prisma.$transaction(async (tx) => {
      const existing = (await tx.refreshToken.findFirst({
        where: {
          tokenHash: hashToken(refreshPlain),
          revokedAt: null,
          expiresAt: { gt: now },
        },
      })) as { id: string; userId: string } | null;

      if (!existing) {
        return null;
      }

      const user = (await tx.user.findUnique({
        where: { id: existing.userId },
        include: sessionUserInclude,
      })) as SessionUser | null;

      if (!user || user.deletedAt || user.isSuperAdmin || user.tenantId === null) {
        await tx.refreshToken.update({
          where: { id: existing.id },
          data: { revokedAt: now },
        });
        return null;
      }

      const session = this.toSessionContext(user);
      const nextRefreshPlain = newRefreshPlain();
      const nextToken = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: hashToken(nextRefreshPlain),
          expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
        },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: {
          revokedAt: now,
          replacedBy: nextToken.id,
        },
      });

      return {
        ...session,
        refreshPlain: nextRefreshPlain,
      };
    });

    if (!rotated) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    return {
      user: rotated.user,
      tenant: rotated.tenant,
      accessToken: signAccess(this.jwt, rotated.payload),
      refreshPlain: rotated.refreshPlain,
    };
  }

  async logout(refreshPlain: string | undefined): Promise<void> {
    if (!refreshPlain) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.refreshToken.findFirst({
        where: {
          tokenHash: hashToken(refreshPlain),
          revokedAt: null,
          expiresAt: { gt: now },
        },
        include: {
          user: true,
        },
      });

      if (!existing) {
        throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
      }

      await tx.refreshToken.update({
        where: {
          id: existing.id,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: existing.user.tenantId,
          userId: existing.userId,
          action: "LOGOUT",
          module: "auth",
          entity: "session",
          entityId: existing.userId,
        },
      });
    });
  }

  private toSessionContext(user: SessionUser) {
    if (!user.tenantId || !user.tenant) {
      throw new AppError("FORBIDDEN", SUPER_ADMIN_LOGIN_MESSAGE, 403);
    }

    const assignment = user.userRoles[0]?.role;
    if (!assignment) {
      throw new AppError("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.", 500);
    }

    const permissions = assignment.permissions.map((item) => item.permission.code);
    const payload: JwtPayload = {
      sub: user.id,
      tid: user.tenant.id,
      role: assignment.name,
      perms: permissions,
    };

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: assignment.name,
        permissions,
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        subscriptionStatus: user.tenant.subscriptionStatus,
        trialEndDate: user.tenant.trialEndDate.toISOString(),
      },
      payload,
    };
  }

  private async getUniqueSlug(tx: Pick<PrismaService, "tenant">, businessName: string): Promise<string> {
    const base = slugify(businessName);
    let candidate = base;

    while (await tx.tenant.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${randomBytes(2).toString("hex")}`;
    }

    return candidate;
  }
}
