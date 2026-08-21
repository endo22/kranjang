import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import { changePasswordSchema, patchMeSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { MeService } from "./me.service.js";

type PatchMeBody = z.infer<typeof patchMeSchema>;
type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  async get(@CurrentUser() currentUser: JwtPayload | undefined) {
    return this.meService.get(this.requireUser(currentUser));
  }

  @Patch()
  async patch(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Body(new ZodPipe(patchMeSchema)) body: PatchMeBody,
  ) {
    return this.meService.patch(this.requireUser(currentUser), body);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordBody,
  ) {
    return this.meService.changePassword(this.requireUser(currentUser), body);
  }

  private requireUser(currentUser: JwtPayload | undefined): JwtPayload {
    if (!currentUser) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    return currentUser;
  }
}
