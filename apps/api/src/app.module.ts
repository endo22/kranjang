import "reflect-metadata";
import "./load-env.js";
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module.js";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { MeModule } from "./me/me.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RolesModule } from "./roles/roles.module.js";
import { TenantsModule } from "./tenants/tenants.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, RolesModule, MeModule, TenantsModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
