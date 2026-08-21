import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  cashierCloseSchema,
  cashierOpenSchema,
  dateRangeQuerySchema,
  diningTableSchema,
  patchDiningTableSchema,
  saleCancelSchema,
  saleHoldCheckoutSchema,
  saleHoldSchema,
  saleSchema,
} from "@kranjang/shared";
import type { Response } from "express";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentOutletId } from "../common/current-outlet.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { parsePagination } from "../common/pagination.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SalesService } from "./sales.service.js";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(@Inject(SalesService) private readonly salesService: SalesService) {}

  @Get("cashier-sessions/current")
  @RequirePermissions("sales.create")
  async current(@CurrentUser() user: JwtPayload | undefined, @Res() response: Response) {
    const session = await this.salesService.currentSession(this.require(user));
    // Nest omits the body when returning null; send explicit JSON null for clients.
    return response.status(HttpStatus.OK).json(session);
  }

  @Post("cashier-sessions/open")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("sales.create")
  open(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Body(new ZodPipe(cashierOpenSchema)) body: z.infer<typeof cashierOpenSchema>,
  ) {
    return this.salesService.openSession(this.require(user), body, outletId);
  }

  @Post("cashier-sessions/:id/close")
  @RequirePermissions("sales.create")
  close(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(cashierCloseSchema)) body: z.infer<typeof cashierCloseSchema>,
  ) {
    return this.salesService.closeSession(this.require(user), id, body);
  }

  @Get("sales")
  @RequirePermissions("sales.view")
  list(
    @CurrentUser() user: JwtPayload | undefined,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parsed = dateRangeQuerySchema.safeParse({ from, to, status });
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Data tidak valid", 400, { issues: parsed.error.issues });
    }
    return this.salesService.listSales(this.require(user), { ...parsed.data, ...parsePagination(limit, offset) });
  }

  @Get("sales/:id")
  @RequirePermissions("sales.view")
  get(@CurrentUser() user: JwtPayload | undefined, @Param("id") id: string) {
    return this.salesService.getSale(this.require(user), id);
  }

  @Post("sales")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("sales.create")
  create(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Body(new ZodPipe(saleSchema)) body: z.infer<typeof saleSchema>,
  ) {
    return this.salesService.createSale(this.require(user), body, outletId);
  }

  @Post("sales/:id/cancel")
  @RequirePermissions("sales.cancel")
  cancel(
    @CurrentUser() user: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(saleCancelSchema)) body: z.infer<typeof saleCancelSchema>,
  ) {
    return this.salesService.cancelSale(this.require(user), id, body);
  }

  @Get("dining-tables")
  @RequirePermissions("sales.create")
  listDiningTables(@CurrentUser() user: JwtPayload | undefined, @CurrentOutletId() outletId: string | undefined) {
    return this.salesService.listDiningTables(this.require(user), outletId);
  }

  @Post("dining-tables")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("sales.create")
  createDiningTable(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Body(new ZodPipe(diningTableSchema)) body: z.infer<typeof diningTableSchema>,
  ) {
    return this.salesService.createDiningTable(this.require(user), body, outletId);
  }

  @Patch("dining-tables/:id")
  @RequirePermissions("sales.create")
  patchDiningTable(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(patchDiningTableSchema)) body: z.infer<typeof patchDiningTableSchema>,
  ) {
    return this.salesService.patchDiningTable(this.require(user), id, body, outletId);
  }

  @Delete("dining-tables/:id")
  @RequirePermissions("sales.create")
  deleteDiningTable(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Param("id") id: string,
  ) {
    return this.salesService.deleteDiningTable(this.require(user), id, outletId);
  }

  @Get("sale-holds")
  @RequirePermissions("sales.create")
  listSaleHolds(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Query("status") status?: string,
  ) {
    return this.salesService.listSaleHolds(this.require(user), status, outletId);
  }

  @Post("sale-holds")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("sales.create")
  createSaleHold(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Body(new ZodPipe(saleHoldSchema)) body: z.infer<typeof saleHoldSchema>,
  ) {
    return this.salesService.createSaleHold(this.require(user), body, outletId);
  }

  @Patch("sale-holds/:id")
  @RequirePermissions("sales.create")
  updateSaleHold(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(saleHoldSchema)) body: z.infer<typeof saleHoldSchema>,
  ) {
    return this.salesService.updateSaleHold(this.require(user), id, body, outletId);
  }

  @Post("sale-holds/:id/cancel")
  @RequirePermissions("sales.create")
  cancelSaleHold(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Param("id") id: string,
  ) {
    return this.salesService.cancelSaleHold(this.require(user), id, outletId);
  }

  @Post("sale-holds/:id/checkout")
  @RequirePermissions("sales.create")
  checkoutSaleHold(
    @CurrentUser() user: JwtPayload | undefined,
    @CurrentOutletId() outletId: string | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(saleHoldCheckoutSchema)) body: z.infer<typeof saleHoldCheckoutSchema>,
  ) {
    return this.salesService.checkoutSaleHold(this.require(user), id, body, outletId);
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
