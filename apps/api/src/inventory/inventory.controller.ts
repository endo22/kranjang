import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { inventoryAdjustSchema } from "@kranjang/shared";
import { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { parsePagination } from "../common/pagination.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { InventoryService } from "./inventory.service.js";

const inventoryMovementsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  productId: z.string().uuid().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

@Controller("inventory")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventoryService: InventoryService) {}

  @Get("movements")
  @RequirePermissions("inventory.view")
  movements(
    @CurrentUser() user: JwtPayload | undefined,
    @Query() query: { from?: string; to?: string; productId?: string; limit?: string; offset?: string },
  ) {
    const parsed = inventoryMovementsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Data tidak valid", 400, {
        issues: parsed.error.issues,
      });
    }
    const page = parsePagination(parsed.data.limit, parsed.data.offset);
    return this.inventoryService.movements(this.require(user), {
      from: parsed.data.from,
      to: parsed.data.to,
      productId: parsed.data.productId,
      ...page,
    });
  }

  @Post("adjust")
  @RequirePermissions("inventory.adjust")
  adjust(@CurrentUser() user: JwtPayload | undefined, @Body(new ZodPipe(inventoryAdjustSchema)) body: z.infer<typeof inventoryAdjustSchema>) {
    return this.inventoryService.adjust(this.require(user), body);
  }

  private require(user: JwtPayload | undefined): JwtPayload {
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return user;
  }
}
