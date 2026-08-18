import { Body, Controller, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import { registerSchema } from "@kranjang/shared";
import type { RegisterBody } from "@kranjang/shared";
import type { Response } from "express";
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
}
