import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
  );

  const cfg = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS is open: any origin, with credentials. `origin: true` reflects the
  // request's Origin header back, which is required when `credentials: true`
  // is set (the spec forbids combining `Access-Control-Allow-Origin: *` with
  // credentialed requests).
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: cfg.get('RATE_LIMIT_MAX', { infer: true }) as number,
    timeWindow: '1 minute',
  });

  const port = cfg.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`POP'S API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
}

bootstrap();
