import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AppError } from "./app-error.js";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser>(err: unknown, user: TUser | false | null): TUser {
    if (err || !user) {
      throw err ?? new AppError("UNAUTHORIZED", "Akses tidak sah", 401);
    }

    return user;
  }
}
