import { Controller, Get, Inject, Param, Query, Res, UseGuards } from "@nestjs/common";
import { reportQuerySchema } from "@kranjang/shared";
import type { Response } from "express";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ReportsService } from "./reports.service.js";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("report.view")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  async dashboard(@CurrentUser() user: JwtPayload | undefined, @Query("from") from?: string, @Query("to") to?: string) {
    const range = this.range(from, to);
    const data = await this.reportsService.summary(this.require(user), range.from, range.to);
    return data.dashboard;
  }

  @Get("reports/:type")
  async report(@CurrentUser() user: JwtPayload | undefined, @Query("from") from?: string, @Query("to") to?: string) {
    const range = this.range(from, to);
    return this.reportsService.summary(this.require(user), range.from, range.to);
  }

  @Get("reports/:type/export")
  async export(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("type") type: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("format") format: string,
    @Res() response: Response,
  ) {
    const range = this.range(from, to);
    const file = await this.reportsService.export(this.require(user), type, range.from, range.to, format === "pdf" ? "pdf" : "xlsx");
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    response.send(file.body);
  }

  private range(from?: string, to?: string) {
    const parsed = reportQuerySchema.safeParse({ from, to });
    if (!parsed.success) {
      const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      return { from: today, to: today };
    }
    return parsed.data;
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
