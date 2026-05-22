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

  // CORS_ORIGINS is either `*` (reflect any origin) or a comma-separated
  // allow-list. We accept exact strings AND simple `*` glob patterns
  // (`https://*.vercel.app`) so Vercel preview URLs don't need a fresh env
  // var per branch — important for the admin (pops-superadmin.vercel.app)
  // which uses preview deploys.
  const corsRaw = cfg.get('CORS_ORIGINS', { infer: true });
  const corsOrigins =
    corsRaw === '*'
      ? true
      : corsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((entry) =>
            entry.includes('*')
              ? new RegExp(
                  '^' +
                    entry
                      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                      .replace(/\*/g, '.*') +
                    '$',
                )
              : entry,
          );
  Logger.log(
    `CORS allow-list: ${corsOrigins === true ? '* (reflect)' : JSON.stringify(corsRaw)}`,
    'Bootstrap',
  );
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: cfg.get('RATE_LIMIT_MAX', { infer: true }) as number,
    timeWindow: '1 minute',
  });

  const port = cfg.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`POP'S API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
}

bootstrap();
