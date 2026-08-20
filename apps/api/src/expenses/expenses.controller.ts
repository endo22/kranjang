import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { expenseSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ExpensesService } from "./expenses.service.js";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(@Inject(ExpensesService) private readonly expensesService: ExpensesService) {}

  @Get("expense-categories")
  @RequirePermissions("expense.view")
  categories(@CurrentUser() user: JwtPayload | undefined) {
    return this.expensesService.listCategories(this.require(user));
  }

  @Get("expenses")
  @RequirePermissions("expense.view")
  list(@CurrentUser() user: JwtPayload | undefined) {
    return this.expensesService.list(this.require(user));
  }

  @Post("expenses")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("expense.create")
  create(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(expenseSchema)) body: z.infer<typeof expenseSchema>) {
    return this.expensesService.create(this.require(user), body);
  }

  @Patch("expenses/:id")
  @RequirePermissions("expense.update")
  update(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(expenseSchema)) body: z.infer<typeof expenseSchema>,
  ) {
    return this.expensesService.update(this.require(user), id, body);
  }

  @Delete("expenses/:id")
  @RequirePermissions("expense.delete")
  remove(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.expensesService.remove(this.require(user), id);
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
