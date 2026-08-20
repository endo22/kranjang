import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { purchaseSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { parsePagination } from "../common/pagination.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { PurchasesService } from "./purchases.service.js";

@Controller("purchases")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasesController {
  constructor(@Inject(PurchasesService) private readonly purchasesService: PurchasesService) {}

  @Get()
  @RequirePermissions("purchase.view")
  list(
    @CurrentUser() user: JwtPayload | undefined,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.purchasesService.list(this.require(user), parsePagination(limit, offset));
  }

  @Get(":id")
  @RequirePermissions("purchase.view")
  get(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.purchasesService.get(this.require(user), id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("purchase.create")
  create(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(purchaseSchema)) body: z.infer<typeof purchaseSchema>) {
    return this.purchasesService.create(this.require(user), body);
  }

  @Post(":id/receive")
  @RequirePermissions("purchase.receive")
  receive(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.purchasesService.receive(this.require(user), id);
  }

  @Post(":id/cancel")
  @RequirePermissions("purchase.create")
  cancel(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.purchasesService.cancelDraft(this.require(user), id);
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
