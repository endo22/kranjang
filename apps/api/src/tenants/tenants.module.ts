import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, PermissionsGuard],
})
export class TenantsModule {}
