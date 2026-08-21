import { jest } from "@jest/globals";
import { ArgumentsHost, BadRequestException, HttpStatus, UnauthorizedException } from "@nestjs/common";
import { AppError } from "../src/common/app-error.js";
import { HttpExceptionFilter } from "../src/common/http-exception.filter.js";

function createHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  return { host, response };
}

describe("HttpExceptionFilter", () => {
  it("preserves AppError payload and status", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new AppError("FORBIDDEN", "Akses ditolak", 403, { scope: "tenant" }), host);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      code: "FORBIDDEN",
      message: "Akses ditolak",
      details: { scope: "tenant" },
    });
  });

  it("maps non-AppError HttpException codes from their status", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new UnauthorizedException("Token tidak valid"), host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      code: "UNAUTHORIZED",
      message: "Token tidak valid",
      details: {},
    });
  });

  it("keeps details from structured 4xx HttpException responses", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(
      new BadRequestException({
        message: "Payload tidak valid",
        details: { field: "email" },
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      code: "VALIDATION_ERROR",
      message: "Payload tidak valid",
      details: { field: "email" },
    });
  });

  it("returns generic INTERNAL_ERROR for unknown exceptions", () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new Error("boom"), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan. Silakan coba lagi.",
      details: {},
    });
  });
});
