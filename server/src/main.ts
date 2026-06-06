import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { FileLogger } from "./logging/file-logger";

async function bootstrap(): Promise<void> {
  const configDir = process.env.CONFIG_DIR || "data";
  const logPath = join(configDir, "logs", "familysync.log");
  const logger = new FileLogger(logPath);
  const app = await NestFactory.create(AppModule, { logger });
  const trustProxy = process.env.TRUST_PROXY?.trim();

  if (trustProxy) {
    app
      .getHttpAdapter()
      .getInstance()
      .set("trust proxy", trustProxy === "true" ? 1 : trustProxy);
  }

  app.setGlobalPrefix("api");
  app.enableCors();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const port = Number(process.env.PORT ?? 6614);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  await app.listen(port);
  logger.log(`FamilySync API listening on http://0.0.0.0:${port}`, "Bootstrap");
}

void bootstrap();
