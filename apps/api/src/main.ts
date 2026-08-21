import "reflect-metadata";
import "./load-env.js";
import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { AdminService } from "./admin/admin.service.js";

function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
}

async function bootstrap(): Promise<void> {
  initSentry();
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_ORIGIN,
    credentials: true,
  });
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");
  await app.listen(Number(process.env.PORT || 3001));
  await app.get(AdminService).ensureSeedAdmin();
}

void bootstrap();
