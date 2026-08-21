import { Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from "@nestjs/common";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { AlertsService } from "./alerts.service.js";

@Controller("alerts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alertsService: AlertsService) {}

  @Post("low-stock")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("inventory.view")
  sendLowStock(@CurrentUser() user: JwtPayload | undefined) {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return this.alertsService.sendLowStockAlert(user);
  }
}
