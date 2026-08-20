import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
