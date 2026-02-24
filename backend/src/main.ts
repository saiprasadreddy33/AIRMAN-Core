import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Support a comma-separated list of allowed origins so multiple Vercel
  // preview/production URLs can all work without redeployment.
  const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, '').toLowerCase();
  const rawOrigins = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  const isAllowedOrigin = (origin: string): boolean => {
    const normalizedOrigin = normalizeOrigin(origin);

    return allowedOrigins.some((allowedOrigin) => {
      if (allowedOrigin.includes('*')) {
        const regexPattern = `^${allowedOrigin
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\*/g, '.*')}$`;
        return new RegExp(regexPattern).test(normalizedOrigin);
      }
      return allowedOrigin === normalizedOrigin;
    });
  };

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    optionsSuccessStatus: 204,
  });
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
