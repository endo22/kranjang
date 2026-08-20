import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { createUserSchema, updateUserSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { UsersService } from "./users.service.js";

type CreateBody = z.infer<typeof createUserSchema>;
type UpdateBody = z.infer<typeof updateUserSchema>;

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("user.manage")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  async list(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.usersService.list(this.requireUser(currentUser), includeInactive === "1" || includeInactive === "true");
  }

  @Get(":id")
  async get(@CurrentUser() currentUser: JwtPayload | undefined, @Param("id") id: string) {
    return this.usersService.get(this.requireUser(currentUser), id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Body(new ZodPipe(createUserSchema)) body: CreateBody,
  ) {
    return this.usersService.create(this.requireUser(currentUser), body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(updateUserSchema)) body: UpdateBody,
  ) {
    return this.usersService.update(this.requireUser(currentUser), id, body);
  }

  @Post(":id/restore")
  async restore(@CurrentUser() currentUser: JwtPayload | undefined, @Param("id") id: string) {
    return this.usersService.restore(this.requireUser(currentUser), id);
  }

  @Delete(":id")
  async remove(@CurrentUser() currentUser: JwtPayload | undefined, @Param("id") id: string) {
    await this.usersService.softDelete(this.requireUser(currentUser), id);
    return { success: true };
  }

  private requireUser(currentUser: JwtPayload | undefined): JwtPayload {
    if (!currentUser) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    return currentUser;
  }
}
