import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { ApiErrorBody } from "@kranjang/shared";
import type { Response } from "express";

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Partial<ApiErrorBody>;
  return typeof body.code === "string" && typeof body.message === "string" && typeof body.details === "object" && body.details !== null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      response.status(status).json(
        isApiErrorBody(payload)
          ? payload
          : {
              code: status === HttpStatus.INTERNAL_SERVER_ERROR ? "INTERNAL_ERROR" : "INTERNAL_ERROR",
              message: typeof payload === "string" ? payload : "Terjadi kesalahan. Silakan coba lagi.",
              details: {},
            },
      );
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan. Silakan coba lagi.",
      details: {},
    } satisfies ApiErrorBody);
  }
}
