import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { loginSchema, registerSchema } from "@kranjang/shared";
import type { LoginBody, RegisterBody } from "@kranjang/shared";
import type { Request, Response } from "express";
import { ZodPipe } from "../common/zod.pipe.js";
import { AuthService } from "./auth.service.js";
import { cookieOptions, REFRESH_COOKIE } from "./tokens.js";

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
    await this.authService.logout(request.cookies?.[REFRESH_COOKIE]);
    response.clearCookie(REFRESH_COOKIE, cookieOptions());

    return { success: true };
  }
}
