import { jest } from "@jest/globals";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../src/auth/auth.service.js";

type UniqueErrorTarget = string | string[];

function prismaUniqueError(target: UniqueErrorTarget) {
  return {
    code: "P2002",
    meta: { target },
  };
}

function createRegisterDeps() {
  const ownerTemplate = {
    name: "Owner",
    permissions: [{ permissionId: "perm-1", permission: { code: "subscription.manage" } }],
  };

  const state = {
    transactionCalls: 0,
    createdSlugs: [] as string[],
  };

  const tx = {
    tenant: {
      findUnique: jest.fn(async ({ where: { slug } }: { where: { slug: string } }) => {
        if (state.transactionCalls === 1) {
          return null;
        }

        if (slug === "toko-sama") {
          return { id: "tenant-existing", slug };
        }

        return null;
      }),
      create: jest.fn(async ({ data }: { data: { slug: string; name: string; email: string; phone: string } }) => {
        state.createdSlugs.push(data.slug);

        if (state.transactionCalls === 1) {
          throw prismaUniqueError(["slug"]);
        }

        return {
          id: "tenant-2",
          name: data.name,
          slug: data.slug,
          email: data.email,
          phone: data.phone,
          subscriptionStatus: "TRIAL",
          trialEndDate: new Date("2026-09-17T00:00:00.000Z"),
        };
      }),
    },
    tenantSettings: { create: jest.fn(async () => ({ id: "settings-1" })) },
    role: {
      create: jest.fn(async ({ data }: { data: { name: string } }) => ({
        id: "role-owner",
        name: data.name,
        permissions: [{ permission: { code: "subscription.manage" } }],
      })),
    },
    user: {
      create: jest.fn(async ({ data }: { data: { name: string; email: string; emailVerifiedAt?: Date | null } }) => ({
        id: "user-1",
        name: data.name,
        email: data.email,
        emailVerifiedAt: data.emailVerifiedAt ?? null,
      })),
    },
    userRole: { create: jest.fn(async () => ({ id: "user-role-1" })) },
    outlet: { create: jest.fn(async () => ({ id: "outlet-1" })) },
    expenseCategory: { createMany: jest.fn(async () => ({ count: 9 })) },
    subscription: { create: jest.fn(async () => ({ id: "subscription-1" })) },
    auditLog: { create: jest.fn(async () => ({ id: "audit-1" })) },
    emailVerificationToken: { create: jest.fn(async () => ({ id: "verify-1" })) },
    refreshToken: { create: jest.fn(async () => ({ id: "refresh-1" })) },
  };

  const prisma = {
    user: {
      findFirst: jest.fn(async () => null),
    },
    subscriptionPlan: {
      findUnique: jest.fn(async () => ({ id: "plan-trial", code: "trial" })),
    },
    role: {
      findMany: jest.fn(async () => [ownerTemplate]),
    },
    $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => {
      state.transactionCalls += 1;
      return callback(tx);
    }),
  };

  return { prisma, state };
}

function createSessionUser() {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    name: "Budi",
    email: "owner@example.com",
    passwordHash: "password-hash",
    isSuperAdmin: false,
    deletedAt: null,
    emailVerifiedAt: null,
    tenant: {
      id: "tenant-1",
      name: "Toko Budi",
      slug: "toko-budi",
      subscriptionStatus: "TRIAL",
      trialEndDate: new Date("2026-09-17T00:00:00.000Z"),
    },
    userRoles: [
      {
        role: {
          name: "Owner",
          permissions: [{ permission: { code: "settings.manage" } }],
        },
      },
    ],
  };
}

function createRefreshDeps(revokeCount = 1) {
  const user = createSessionUser();
  const tx = {
    refreshToken: {
      findFirst: jest.fn(async () => ({ id: "refresh-1", userId: user.id })),
      updateMany: jest.fn(async () => ({ count: revokeCount })),
      create: jest.fn(async () => ({ id: "refresh-2" })),
      update: jest.fn(async () => ({ id: "refresh-1" })),
    },
    user: {
      findUnique: jest.fn(async () => user),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
  };

  return { prisma, tx };
}

describe("AuthService.register", () => {
  it("retries the transaction with a new slug when Prisma reports slug conflict", async () => {
    const { prisma, state } = createRegisterDeps();
    const service = new AuthService(prisma as never, new JwtService({ secret: "test-secret" }));

    const result = await service.register({
      businessName: "Toko Sama",
      ownerName: "Budi",
      email: "owner@example.com",
      password: "password12",
      phone: "081234567890",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(state.createdSlugs).toHaveLength(2);
    expect(state.createdSlugs[0]).toBe("toko-sama");
    expect(state.createdSlugs[1]).toMatch(/^toko-sama-[a-f0-9]{4}$/);
    expect(result.tenant.slug).toBe(state.createdSlugs[1]);
  });

  it("keeps email conflict mapped to AppError when Prisma reports email unique violation", async () => {
    const { prisma } = createRegisterDeps();
    prisma.$transaction = jest.fn(async () => {
      throw prismaUniqueError(["email"]);
    });

    const service = new AuthService(prisma as never, new JwtService({ secret: "test-secret" }));

    await expect(
      service.register({
        businessName: "Toko Email",
        ownerName: "Budi",
        email: "owner@example.com",
        password: "password12",
        phone: "081234567890",
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: "CONFLICT",
        message: "Email sudah terpakai",
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("AuthService.refresh", () => {
  it("rejects refresh when the presented token can no longer be atomically revoked", async () => {
    const { prisma, tx } = createRefreshDeps(0);
    const service = new AuthService(prisma as never, new JwtService({ secret: "test-secret" }));

    await expect(service.refresh("presented-refresh-token")).rejects.toMatchObject({
      status: 401,
      response: {
        code: "UNAUTHORIZED",
        message: "Akses tidak sah",
      },
    });

    expect(tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });
});
