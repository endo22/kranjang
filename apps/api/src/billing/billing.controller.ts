import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { checkoutSchema, mockPaySchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { BillingService } from "./billing.service.js";

@Controller("billing")
export class BillingController {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Get("current")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("subscription.manage")
  current(@CurrentUser() user: JwtPayload | undefined) {
    return this.billingService.getCurrent(this.require(user));
  }

  @Post("checkout")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("subscription.manage")
  checkout(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>) {
    return this.billingService.checkout(this.require(user), body);
  }

  @Post("cancel")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("subscription.manage")
  cancel(@CurrentUser() user: JwtPayload | undefined) {
    return this.billingService.cancel(this.require(user));
  }

  @Post("mock-pay")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("subscription.manage")
  mockPay(@Body(new ZodPipe(mockPaySchema)) body: z.infer<typeof mockPaySchema>) {
    return this.billingService.mockPay(body.orderId);
  }

  @Post("webhook")
  webhook(@Body() body: Record<string, string>) {
    return this.billingService.webhook(body);
  }

  @Post("jobs/sweep")
  sweep() {
    return this.billingService.runBillingSweep();
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
