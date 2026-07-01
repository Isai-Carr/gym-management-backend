import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditService } from './audit/audit.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── Static file serving ──────────────────────────────────────────────────
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/storage/' });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

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
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Oasis Training Center API running on port ${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`💚 Health check: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((err) => {
  process.stderr.write(`Fatal error during bootstrap: ${err?.message ?? err}\n${err?.stack ?? ''}\n`, () => {
    process.exit(1);
  });
});
