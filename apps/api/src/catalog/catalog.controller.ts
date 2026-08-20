import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { categorySchema, patchProductSchema, productSchema, recipeSchema } from "@kranjang/shared";
import type { z } from "zod";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { CurrentUser } from "../common/current-user.js";
import { JwtAuthGuard } from "../common/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { RequirePermissions } from "../common/require-permissions.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CatalogService } from "./catalog.service.js";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get("categories")
  @RequirePermissions("product.view")
  listCategories(@CurrentUser() currentUser: JwtPayload | undefined) {
    return this.catalogService.listCategories(this.requireUser(currentUser));
  }

  @Post("categories")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("product.create")
  createCategory(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Body(new ZodPipe(categorySchema)) body: z.infer<typeof categorySchema>,
  ) {
    return this.catalogService.createCategory(this.requireUser(currentUser), body);
  }

  @Patch("categories/:id")
  @RequirePermissions("product.update")
  updateCategory(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(categorySchema)) body: z.infer<typeof categorySchema>,
  ) {
    return this.catalogService.updateCategory(this.requireUser(currentUser), id, body);
  }

  @Delete("categories/:id")
  @RequirePermissions("product.delete")
  deleteCategory(@CurrentUser() currentUser: JwtPayload | undefined, @Param("id") id: string) {
    return this.catalogService.deleteCategory(this.requireUser(currentUser), id);
  }

  @Get("products")
  @RequirePermissions("product.view")
  listProducts(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Query("q") q?: string,
    @Query("categoryId") categoryId?: string,
    @Query("productType") productType?: string,
    @Query("type") legacyType?: string,
    @Query("search") legacySearch?: string,
  ) {
    return this.catalogService.listProducts(this.requireUser(currentUser), {
      q: q ?? legacySearch,
      categoryId,
      productType: productType ?? legacyType,
    });
  }

  @Get("products/:id")
  @RequirePermissions("product.view")
  getProduct(@CurrentUser() currentUser: JwtPayload | undefined, @Param("id") id: string) {
    return this.catalogService.getProduct(this.requireUser(currentUser), id);
  }

  @Post("products")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("product.create")
  createProduct(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Body(new ZodPipe(productSchema)) body: z.infer<typeof productSchema>,
  ) {
    return this.catalogService.createProduct(this.requireUser(currentUser), body);
  }

  @Patch("products/:id")
  @RequirePermissions("product.update")
  updateProduct(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(patchProductSchema)) body: z.infer<typeof patchProductSchema>,
  ) {
    return this.catalogService.updateProduct(this.requireUser(currentUser), id, body);
  }

  @Delete("products/:id")
  @RequirePermissions("product.delete")
  deleteProduct(@CurrentUser() currentUser: JwtPayload | undefined, @Param("id") id: string) {
    return this.catalogService.deleteProduct(this.requireUser(currentUser), id);
  }

  @Put("products/:id/recipe")
  @RequirePermissions("recipe.manage")
  replaceRecipe(
    @CurrentUser() currentUser: JwtPayload | undefined,
    @Param("id") id: string,
    @Body(new ZodPipe(recipeSchema)) body: z.infer<typeof recipeSchema>,
  ) {
    return this.catalogService.replaceRecipe(this.requireUser(currentUser), id, body);
  }

  private requireUser(currentUser: JwtPayload | undefined): JwtPayload {
    if (!currentUser) {
      throw new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }
    return currentUser;
  }
}
