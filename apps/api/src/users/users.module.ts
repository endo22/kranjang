import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

@Module({
  controllers: [UsersController],
  providers: [UsersService, PermissionsGuard],
})
export class UsersModule {}
