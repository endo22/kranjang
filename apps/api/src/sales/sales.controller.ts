import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { cashierCloseSchema, cashierOpenSchema, saleSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SalesService } from "./sales.service.js";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(@Inject(SalesService) private readonly salesService: SalesService) {}

  @Get("cashier-sessions/current")
  @RequirePermissions("sales.create")
  current(@CurrentUser() user: JwtPayload | undefined) {
    return this.salesService.currentSession(this.require(user));
  }

  @Post("cashier-sessions/open")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("sales.create")
  open(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(cashierOpenSchema)) body: z.infer<typeof cashierOpenSchema>) {
    return this.salesService.openSession(this.require(user), body);
  }

  @Post("cashier-sessions/:id/close")
  @RequirePermissions("sales.create")
  close(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(cashierCloseSchema)) body: z.infer<typeof cashierCloseSchema>,
  ) {
    return this.salesService.closeSession(this.require(user), id, body);
  }

  @Get("sales")
  @RequirePermissions("sales.view")
  list(@CurrentUser() user: JwtPayload | undefined) {
    return this.salesService.listSales(this.require(user));
  }

  @Get("sales/:id")
  @RequirePermissions("sales.view")
  get(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.salesService.getSale(this.require(user), id);
  }

  @Post("sales")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("sales.create")
  create(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(saleSchema)) body: z.infer<typeof saleSchema>) {
    return this.salesService.createSale(this.require(user), body);
  }

  @Post("sales/:id/cancel")
  @RequirePermissions("sales.cancel")
  cancel(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.salesService.cancelSale(this.require(user), id);
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
