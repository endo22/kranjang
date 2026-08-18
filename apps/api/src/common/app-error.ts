import { HttpException, HttpStatus } from "@nestjs/common";
import { ApiErrorBody, ErrorCode } from "@kranjang/shared";

export class AppError extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    status: number = HttpStatus.INTERNAL_SERVER_ERROR,
    details: Record<string, unknown> = {},
  ) {
    super({ code, message, details } satisfies ApiErrorBody, status);
  }
}
