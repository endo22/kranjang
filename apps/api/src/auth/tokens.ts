import { createHash, randomBytes } from "node:crypto";
import { JwtService } from "@nestjs/jwt";

export const REFRESH_COOKIE = "kranjang_refresh";
export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type JwtPayload = { sub: string; tid: string; role: string; perms: string[] };

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function newRefreshPlain(): string {
  return randomBytes(32).toString("hex");
}

export function signAccess(jwt: JwtService, payload: JwtPayload): string {
  return jwt.sign(payload, { expiresIn: ACCESS_TTL_SEC });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/api/v1/auth",
    secure: process.env.NODE_ENV === "production",
    maxAge: REFRESH_TTL_MS,
  };
}
