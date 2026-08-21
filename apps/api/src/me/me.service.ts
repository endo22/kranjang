import { Algorithm, hash as hashPassword, verify as verifyPassword } from "@node-rs/argon2";
import { Inject, Injectable } from "@nestjs/common";
import { changePasswordSchema, patchMeSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { PrismaService } from "../prisma/prisma.service.js";

type PatchMeBody = z.infer<typeof patchMeSchema>;
type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

@Injectable()
export class MeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(currentUser: JwtPayload) {
    return this.toMeResponse(await this.getScopedUser(currentUser));
  }

  async patch(currentUser: JwtPayload, body: PatchMeBody) {
    const user = await this.getScopedUser(currentUser);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name ?? user.name,
        phone: body.phone === undefined ? user.phone : body.phone,
      },
    });

    return this.toMeResponse(updated);
  }

  async changePassword(currentUser: JwtPayload, body: ChangePasswordBody) {
    const user = await this.getScopedUser(currentUser);
    const currentMatches = await verifyPassword(user.passwordHash, body.currentPassword);

    if (!currentMatches) {
      throw new AppError("VALIDATION_ERROR", "Password saat ini salah.", 400);
    }

    const passwordHash = await hashPassword(body.newPassword, {
      algorithm: Algorithm.Argon2id,
    });
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });
    });

    return { success: true };
  }

  private async getScopedUser(currentUser: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: currentUser.sub,
        tenantId: currentUser.tid,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
    }

    return user;
  }

  private toMeResponse(user: Awaited<ReturnType<MeService["getScopedUser"]>>) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
