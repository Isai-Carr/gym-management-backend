import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { setDefaultResultOrder } from 'dns';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditService } from './audit/audit.service';

// Railway's network can't route IPv6 (ENETUNREACH on Gmail's AAAA record),
// but Node resolves dual-stack hosts IPv6-first by default — outbound
// connections (SMTP, MercadoPago, ...) were intermittently hanging/timing out.
setDefaultResultOrder('ipv4first');

console.log('main.ts loaded');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION');
  console.error(err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION');
  console.error(err);
});

process.on('exit', (code) => {
  console.log('PROCESS EXIT', code);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED');
});

process.on('SIGINT', () => {
  console.log('SIGINT RECEIVED');
});

async function bootstrap() {
  console.log('Before NestFactory.create()');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  console.log('NestFactory.create() completed');

  // ── Static file serving ──────────────────────────────────────────────────
  // Both prefixes are served out of the same `storage/` tree so a single
  // persistent volume (Railway allows only one per service) covers all uploads.
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/storage/' });
  app.useStaticAssets(join(process.cwd(), 'storage', 'uploads'), { prefix: '/uploads/' });

  // ── Global prefix & versioning ──────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.NODE_ENV === 'development'
      ? true
      : process.env.ALLOWED_ORIGINS?.split(',') ?? false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Global validation pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global exception filter ──────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Global interceptors ──────────────────────────────────────────────────
  const auditService = app.get(AuditService);
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new AuditInterceptor(auditService),
  );

  // ── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Oasis Training Center — API')
    .setDescription(
      'REST API for Oasis Training Center gym management system.\n\n' +
      'Base URL: `/api/v1`\n\n' +
      'Use **Authorize** to provide your JWT Bearer token.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT',
    )
    .addTag('Auth', 'Authentication and user account management')
    .addTag('Clients', 'Client management (Admin)')
    .addTag('Activities', 'Gym activities management')
    .addTag('Memberships', 'Membership plans and subscriptions')
    .addTag('Payments', 'Payment processing and approval')
    .addTag('Attendance', 'Check-in and attendance tracking')
    .addTag('Classes', 'Class scheduling and management')
    .addTag('Reservations', 'Class reservation system')
    .addTag('Personal Records', 'Client personal records (PRs)')
    .addTag('Inventory', 'Gym equipment and inventory')
    .addTag('Reports', 'Administrative reports and analytics')
    .addTag('Notifications', 'System notifications and emails')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // ── Server ───────────────────────────────────────────────────────────────
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Oasis Training Center API running on port ${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`💚 Health check: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((err) => {
  process.stderr.write(`Fatal error during bootstrap: ${err?.message ?? err}\n${err?.stack ?? ''}\n`, () => {
    process.exit(1);
  });
});
