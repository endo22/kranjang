import { Inject, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../auth/tokens.js";
import { PrismaService } from "../prisma/prisma.service.js";

const roleInclude = {
  permissions: {
    include: {
      permission: true,
    },
  },
} as const;

@Injectable()
export class RolesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(currentUser: JwtPayload) {
    const roles = await this.prisma.role.findMany({
      where: {
        tenantId: currentUser.tid,
      },
      include: roleInclude,
      orderBy: { name: "asc" },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions.map((item) => ({
        code: item.permission.code,
        module: item.permission.module,
        description: item.permission.description,
      })),
    }));
  }
}
