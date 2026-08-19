import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
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
@RequirePermissions("settings.manage")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get(@CurrentUser() currentUser: JwtPayload | undefined) {
    return this.settingsService.get(this.requireUser(currentUser));
  }

  @Patch()
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
