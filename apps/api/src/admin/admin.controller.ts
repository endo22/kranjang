import { Body, CanActivate, Controller, ExecutionContext, Get, Inject, Injectable, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { adminLoginSchema, adminPlanSchema, adminTenantStatusSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { AdminService } from "./admin.service.js";

@Injectable()
class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (request.user?.role !== "SuperAdmin") {
      throw new AppError("FORBIDDEN", "Akses ditolak", 403);
    }
    return true;
  }
}

@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Post("auth/login")
  login(@Body(new ZodPipe(adminLoginSchema)) body: z.infer<typeof adminLoginSchema>) {
    return this.adminService.login(body);
  }

  @Get("overview")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  overview() {
    return this.adminService.overview();
  }

  @Get("tenants")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  tenants(@Query("q") q?: string) {
    return this.adminService.listTenants(q);
  }

  @Patch("tenants/:id/status")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  updateTenant(
    @Param("id") id: string,
    @Body(new ZodPipe(adminTenantStatusSchema)) body: z.infer<typeof adminTenantStatusSchema>,
  ) {
    return this.adminService.updateTenantStatus(id, body);
  }

  @Get("plans")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  plans() {
    return this.adminService.listPlans();
  }

  @Patch("plans/:id")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  updatePlan(@Param("id") id: string, @Body(new ZodPipe(adminPlanSchema)) body: z.infer<typeof adminPlanSchema>) {
    return this.adminService.updatePlan(id, body);
  }

  @Get("payments")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  payments() {
    return this.adminService.listPayments();
  }

  @Get("audit-logs")
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  auditLogs() {
    return this.adminService.listAuditLogs();
  }
}
