import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { FileLogger } from "./logging/file-logger";

async function bootstrap(): Promise<void> {
  const configDir = process.env.CONFIG_DIR || "data";
  const logPath =
    process.env.LOG_PATH ?? join(configDir, "logs", "familysync.log");
  const logger = new FileLogger(logPath);
  const app = await NestFactory.create(AppModule, { logger });
  app.setGlobalPrefix("api");
  app.enableCors();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`FamilySync API listening on http://0.0.0.0:${port}`, "Bootstrap");
}

void bootstrap();
