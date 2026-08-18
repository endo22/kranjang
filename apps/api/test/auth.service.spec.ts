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

        if (slug === "warung-sama") {
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

describe("AuthService.register", () => {
  it("retries the transaction with a new slug when Prisma reports slug conflict", async () => {
    const { prisma, state } = createRegisterDeps();
    const service = new AuthService(prisma as never, new JwtService({ secret: "test-secret" }));

    const result = await service.register({
      businessName: "Warung Sama",
      ownerName: "Budi",
      email: "owner@example.com",
      password: "password12",
      phone: "081234567890",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(state.createdSlugs).toHaveLength(2);
    expect(state.createdSlugs[0]).toBe("warung-sama");
    expect(state.createdSlugs[1]).toMatch(/^warung-sama-[a-f0-9]{4}$/);
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
        businessName: "Warung Email",
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
