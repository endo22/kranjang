import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import type { RegisterBody } from "@kranjang/shared";

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");
  await app.init();
  return app;
}

export function uniqueEmail(): string {
  return `kranjang-test-${randomUUID()}@example.com`;
}

export function registerBody(overrides: Partial<RegisterBody> = {}): RegisterBody {
  return {
    businessName: "Warung Nasi Goreng Pak Budi",
    ownerName: "Budi",
    email: uniqueEmail(),
    password: "password12",
    phone: "081234567890",
    ...overrides,
  };
}

export function register(app: INestApplication, body?: Partial<RegisterBody>) {
  return request(app.getHttpServer()).post("/api/v1/auth/register").send(registerBody(body));
}
