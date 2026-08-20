import { Prisma } from "@kranjang/db";
import type { JwtPayload } from "../auth/tokens.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "./app-error.js";

const WRITABLE_STATUSES = new Set(["TRIAL", "ACTIVE", "GRACE_PERIOD"]);

export async function requireTenantOutlet(prisma: PrismaService, currentUser: JwtPayload) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: currentUser.tid, deletedAt: null },
    include: { settings: true },
  });

  if (!tenant) {
    throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
  }

  const outlet = await prisma.outlet.findFirst({
    where: { tenantId: currentUser.tid, deletedAt: null, isDefault: true },
  });

  if (!outlet) {
    throw new AppError("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.", 500);
  }

  return { tenant, outlet };
}

export function assertWritableSubscription(status: string) {
  if (!WRITABLE_STATUSES.has(status)) {
    throw new AppError("SUBSCRIPTION_INACTIVE", "Langganan tidak aktif. Perpanjang paket untuk menambah data.", 403);
  }
}

export async function writeAudit(
  tx: Prisma.TransactionClient | PrismaService,
  input: {
    tenantId: string;
    userId: string;
    action: string;
    module: string;
    entity: string;
    entityId: string;
    newValue?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      module: input.module,
      entity: input.entity,
      entityId: input.entityId,
      newValue: input.newValue,
    },
  });
}
