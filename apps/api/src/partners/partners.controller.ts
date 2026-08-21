import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { customerSchema, supplierSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { PartnersService } from "./partners.service.js";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PartnersController {
  constructor(@Inject(PartnersService) private readonly partnersService: PartnersService) {}

  @Get("suppliers")
  @RequirePermissions("purchase.view")
  listSuppliers(@CurrentUser() user: JwtPayload | undefined, @Query("q") q?: string) {
    return this.partnersService.listSuppliers(this.require(user), q);
  }

  @Post("suppliers")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("purchase.create")
  createSupplier(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(supplierSchema)) body: z.infer<typeof supplierSchema>) {
    return this.partnersService.createSupplier(this.require(user), body);
  }

  @Patch("suppliers/:id")
  @RequirePermissions("purchase.create")
  updateSupplier(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(supplierSchema)) body: z.infer<typeof supplierSchema>,
  ) {
    return this.partnersService.updateSupplier(this.require(user), id, body);
  }

  @Delete("suppliers/:id")
  @RequirePermissions("purchase.create")
  deleteSupplier(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.partnersService.deleteSupplier(this.require(user), id);
  }

  @Get("customers")
  @RequirePermissions("sales.view")
  listCustomers(@CurrentUser() user: JwtPayload | undefined, @Query("q") q?: string) {
    return this.partnersService.listCustomers(this.require(user), q);
  }

  @Post("customers")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("sales.create")
  createCustomer(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(customerSchema)) body: z.infer<typeof customerSchema>) {
    return this.partnersService.createCustomer(this.require(user), body);
  }

  @Patch("customers/:id")
  @RequirePermissions("sales.create")
  updateCustomer(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(customerSchema)) body: z.infer<typeof customerSchema>,
  ) {
    return this.partnersService.updateCustomer(this.require(user), id, body);
  }

  @Delete("customers/:id")
  @RequirePermissions("sales.create")
  deleteCustomer(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.partnersService.deleteCustomer(this.require(user), id);
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
