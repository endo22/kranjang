import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RolesController } from "./roles.controller.js";
import { RolesService } from "./roles.service.js";

@Module({
  controllers: [RolesController],
  providers: [RolesService, PermissionsGuard],
})
export class RolesModule {}
