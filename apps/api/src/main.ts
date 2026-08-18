import "reflect-metadata";
import "./load-env.js";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_ORIGIN,
    credentials: true,
  });
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");
  await app.listen(Number(process.env.PORT || 3001));
}

void bootstrap();
