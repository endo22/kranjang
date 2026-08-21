import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { outletSchema, patchOutletSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { OutletsService } from "./outlets.service.js";

@Controller("outlets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OutletsController {
  constructor(@Inject(OutletsService) private readonly outletsService: OutletsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload | undefined) {
    return this.outletsService.list(this.require(user));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("settings.manage")
  create(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(outletSchema)) body: z.infer<typeof outletSchema>) {
    return this.outletsService.create(this.require(user), body);
  }

  @Patch(":id")
  @RequirePermissions("settings.manage")
  patch(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(patchOutletSchema)) body: z.infer<typeof patchOutletSchema>,
  ) {
    return this.outletsService.patch(this.require(user), id, body);
  }

  @Delete(":id")
  @RequirePermissions("settings.manage")
  remove(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.outletsService.remove(this.require(user), id);
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
