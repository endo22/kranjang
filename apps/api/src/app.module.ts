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
import { CatalogModule } from "./catalog/catalog.module.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { SalesModule } from "./sales/sales.module.js";
import { PartnersModule } from "./partners/partners.module.js";
import { PurchasesModule } from "./purchases/purchases.module.js";
import { ExpensesModule } from "./expenses/expenses.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { AdminModule } from "./admin/admin.module.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    MeModule,
    TenantsModule,
    CatalogModule,
    InventoryModule,
    SalesModule,
    PartnersModule,
    PurchasesModule,
    ExpensesModule,
    ReportsModule,
    BillingModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
