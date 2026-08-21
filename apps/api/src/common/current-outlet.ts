import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const CurrentOutletId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const value = request.headers["x-outlet-id"];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
});
