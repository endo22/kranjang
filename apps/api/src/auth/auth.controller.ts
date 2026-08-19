import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from "@kranjang/shared";
import type { LoginBody, RegisterBody } from "@kranjang/shared";
import type { Request, Response } from "express";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe.js";
import { AuthService } from "./auth.service.js";
import { cookieOptions, REFRESH_COOKIE } from "./tokens.js";

type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
type VerifyEmailBody = z.infer<typeof verifyEmailSchema>;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodPipe(registerSchema)) body: RegisterBody,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(body);
    response.cookie(REFRESH_COOKIE, result.refreshPlain, cookieOptions());

    return {
      user: result.user,
      tenant: result.tenant,
      accessToken: result.accessToken,
    };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body);
    response.cookie(REFRESH_COOKIE, result.refreshPlain, cookieOptions());

    return {
      user: result.user,
      tenant: result.tenant,
      accessToken: result.accessToken,
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.refresh(request.cookies?.[REFRESH_COOKIE]);
      response.cookie(REFRESH_COOKIE, result.refreshPlain, cookieOptions());

      return {
        user: result.user,
        tenant: result.tenant,
        accessToken: result.accessToken,
      };
    } catch (error) {
      response.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      await this.authService.logout(request.cookies?.[REFRESH_COOKIE]);
      response.clearCookie(REFRESH_COOKIE, cookieOptions());
    } catch (error) {
      response.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw error;
    }

    return { success: true };
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(new ZodPipe(verifyEmailSchema)) body: VerifyEmailBody) {
    await this.authService.verifyEmail(body.token);
    return { ok: true };
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body(new ZodPipe(forgotPasswordSchema)) body: ForgotPasswordBody) {
    await this.authService.forgotPassword(body.email);
    return { ok: true };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body(new ZodPipe(resetPasswordSchema)) body: ResetPasswordBody) {
    await this.authService.resetPassword(body.token, body.password);
    return { ok: true };
  }
}
