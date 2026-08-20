import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ApiErrorBody, ErrorCode } from "@kranjang/shared";
import type { Response } from "express";

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Partial<ApiErrorBody>;
  return typeof body.code === "string" && typeof body.message === "string" && typeof body.details === "object" && body.details !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mapStatusToCode(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "VALIDATION_ERROR";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR";
  }
}

function getDefaultMessage(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "Data tidak valid";
    case HttpStatus.UNAUTHORIZED:
      return "Akses tidak sah";
    case HttpStatus.FORBIDDEN:
      return "Akses ditolak";
    case HttpStatus.NOT_FOUND:
      return "Data tidak ditemukan";
    case HttpStatus.CONFLICT:
      return "Terjadi konflik data";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "Terlalu banyak permintaan";
    default:
      return "Terjadi kesalahan. Silakan coba lagi.";
  }
}

function getHttpExceptionMessage(payload: unknown, status: number): string {
  if (status >= 500) {
    return "Terjadi kesalahan. Silakan coba lagi.";
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (isRecord(payload)) {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }

    if (Array.isArray(payload.message)) {
      const messages = payload.message.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      if (messages.length > 0) {
        return messages.join(", ");
      }
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  }

  return getDefaultMessage(status);
}

function getHttpExceptionDetails(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {};
  }

  if (isRecord(payload.details)) {
    return payload.details;
  }

  if (Array.isArray(payload.message)) {
    const messages = payload.message.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (messages.length > 0) {
      return { issues: messages };
    }
  }

  return {};
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
              code: mapStatusToCode(status),
              message: getHttpExceptionMessage(payload, status),
              details: getHttpExceptionDetails(payload),
            },
      );
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan. Silakan coba lagi.",
      details: {},
    } satisfies ApiErrorBody);

    const logger = new Logger(HttpExceptionFilter.name);
    if (process.env.NODE_ENV !== "test") {
      logger.error(exception instanceof Error ? exception.stack ?? exception.message : exception);
    }
  }
}
