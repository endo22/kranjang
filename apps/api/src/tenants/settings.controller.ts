import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { patchSettingsSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SettingsService } from "./settings.service.js";

type PatchSettingsBody = z.infer<typeof patchSettingsSchema>;

@Controller("settings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  @Get()
  async get(@CurrentUser() currentUser: JwtPayload | undefined) {
    const user = this.requireUser(currentUser);
    if (!user.perms.includes("settings.manage") && !user.perms.includes("sales.create")) {
      throw new AppError("FORBIDDEN", "Anda tidak memiliki izin untuk aksi ini.", 403);
    }
    return this.settingsService.get(user);
  }

  @Patch()
  @RequirePermissions("settings.manage")
  async patch(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Body(new ZodPipe(patchSettingsSchema)) body: PatchSettingsBody,
  ) {
    return this.settingsService.patch(this.requireUser(currentUser), body);
  }

  private requireUser(currentUser: JwtPayload | undefined): JwtPayload {
    if (!currentUser) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    return currentUser;
  }
}
