import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "./app-error.js";
import { REQUIRED_PERMISSIONS_KEY } from "./require-permissions.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    if (requiredPermissions.every((permission) => user.perms.includes(permission))) {
      return true;
    }

    throw new AppError("FORBIDDEN", "Anda tidak memiliki izin untuk aksi ini.", 403);
  }
}
