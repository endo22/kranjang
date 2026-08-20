import { Algorithm, hash as hashPassword } from "@node-rs/argon2";
import { Inject, Injectable } from "@nestjs/common";
import { createUserSchema, updateUserSchema } from "@kranjang/shared";
import type { z } from "zod";
import { AppError } from "../common/app-error.js";
import type { JwtPayload } from "../auth/tokens.js";
import { PrismaService } from "../prisma/prisma.service.js";

const userInclude = {
  userRoles: {
    include: {
      role: true,
    },
  },
} as const;

type UserWithRole = Awaited<ReturnType<UsersService["getScopedUser"]>>;
type CreateUserBody = z.infer<typeof createUserSchema>;
type UpdateUserBody = z.infer<typeof updateUserSchema>;

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
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(currentUser: JwtPayload, includeInactive = false) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: currentUser.tid,
        ...(includeInactive ? {} : { deletedAt: null }),
      },
      include: userInclude,
      orderBy: { createdAt: "asc" },
    });

    return users.map((user) => this.toUserResponse(user));
  }

  async get(currentUser: JwtPayload, id: string) {
    return this.toUserResponse(await this.getScopedUser(currentUser.tid, id));
  }

  async create(currentUser: JwtPayload, body: CreateUserBody) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: body.email,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new AppError("CONFLICT", "Email sudah terpakai", 409);
    }

    const role = await this.getTenantRole(currentUser.tid, body.roleId);
    const passwordHash = await hashPassword(body.password, {
      algorithm: Algorithm.Argon2id,
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId: currentUser.tid,
            name: body.name,
            email: body.email,
            passwordHash,
            phone: body.phone ?? null,
          },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });

        const createdUser = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: userInclude,
        });

        await tx.auditLog.create({
          data: {
            tenantId: currentUser.tid,
            userId: currentUser.sub,
            action: "CREATE",
            module: "user",
            entity: "user",
            entityId: user.id,
            newValue: this.toAuditUserSnapshot(createdUser, role.name),
          },
        });

        return createdUser;
      });

      return this.toUserResponse(created);
    } catch (error) {
      if (isPrismaUniqueError(error) && hasUniqueTarget(error, "email")) {
        throw new AppError("CONFLICT", "Email sudah terpakai", 409);
      }

      throw error;
    }
  }

  async update(currentUser: JwtPayload, id: string, body: UpdateUserBody) {
    const user = await this.getScopedUser(currentUser.tid, id);
    const assignedRole = this.getAssignedRole(user);
    const nextRole = body.roleId ? await this.getTenantRole(currentUser.tid, body.roleId) : assignedRole;

    if (assignedRole.name === "Owner" && nextRole.name !== "Owner") {
      await this.assertCanChangeLastOwner(currentUser.tid, user.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: body.name ?? user.name,
          phone: body.phone === undefined ? user.phone : body.phone,
        },
      });

      if (body.roleId && body.roleId !== assignedRole.id) {
        await tx.userRole.deleteMany({
          where: { userId: user.id },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: nextRole.id,
          },
        });
      }

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: userInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId: currentUser.tid,
          userId: currentUser.sub,
          action: "UPDATE",
          module: "user",
          entity: "user",
          entityId: user.id,
          oldValue: this.toAuditUserSnapshot(user, assignedRole.name),
          newValue: this.toAuditUserSnapshot(updatedUser, this.getAssignedRole(updatedUser).name),
        },
      });

      return updatedUser;
    });

    return this.toUserResponse(updated);
  }

  async softDelete(currentUser: JwtPayload, id: string) {
    if (id === currentUser.sub) {
      throw new AppError("VALIDATION_ERROR", "Anda tidak dapat menonaktifkan akun sendiri.", 400);
    }

    const user = await this.getScopedUser(currentUser.tid, id);
    const assignedRole = this.getAssignedRole(user);

    if (assignedRole.name === "Owner") {
      await this.assertCanChangeLastOwner(currentUser.tid, user.id);
    }

    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          deletedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: currentUser.tid,
          userId: currentUser.sub,
          action: "DELETE",
          module: "user",
          entity: "user",
          entityId: user.id,
          oldValue: this.toAuditUserSnapshot(user, assignedRole.name),
          newValue: {
            ...this.toAuditUserSnapshot(user, assignedRole.name),
            deletedAt: deletedAt.toISOString(),
          },
        },
      });
    });
  }

  async restore(currentUser: JwtPayload, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: currentUser.tid, deletedAt: { not: null } },
      include: userInclude,
    });
    if (!user) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }

    const assignedRole = this.getAssignedRole(user);
    const restored = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { deletedAt: null },
        include: userInclude,
      });
      await tx.auditLog.create({
        data: {
          tenantId: currentUser.tid,
          userId: currentUser.sub,
          action: "RESTORE",
          module: "user",
          entity: "user",
          entityId: user.id,
          oldValue: this.toAuditUserSnapshot(user, assignedRole.name),
          newValue: this.toAuditUserSnapshot(updated, assignedRole.name),
        },
      });
      return updated;
    });

    return this.toUserResponse(restored);
  }

  private async getScopedUser(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: userInclude,
    });

    if (!user) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }

    return user;
  }

  private async getTenantRole(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
    });

    if (!role) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }

    return role;
  }

  private getAssignedRole(user: UserWithRole) {
    const role = user.userRoles[0]?.role;
    if (!role) {
      throw new AppError("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.", 500);
    }

    return role;
  }

  private async assertCanChangeLastOwner(tenantId: string, userId: string) {
    const ownerCount = await this.prisma.userRole.count({
      where: {
        role: {
          tenantId,
          name: "Owner",
        },
        user: {
          tenantId,
          deletedAt: null,
        },
      },
    });

    if (ownerCount <= 1) {
      throw new AppError("VALIDATION_ERROR", "Owner terakhir tidak dapat dihapus atau diturunkan.", 400);
    }

    const isOwner = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          tenantId,
          name: "Owner",
        },
        user: {
          tenantId,
          deletedAt: null,
        },
      },
    });

    if (!isOwner) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }
  }

  private toUserResponse(user: UserWithRole) {
    const role = this.getAssignedRole(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: {
        id: role.id,
        name: role.name,
      },
      createdAt: user.createdAt.toISOString(),
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
    };
  }

  private toAuditUserSnapshot(user: UserWithRole, roleName: string) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: roleName,
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
    };
  }
}
