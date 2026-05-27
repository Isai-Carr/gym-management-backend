import { ValidationPipe } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';

import {
  SwaggerModule,
  DocumentBuilder,
} from '@nestjs/swagger';

import { NestExpressApplication } from '@nestjs/platform-express';

import { join } from 'path';

import { AppModule } from './app.module';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';

import { AuditInterceptor } from './common/interceptors/audit.interceptor';

import { AuditService } from './audit/audit.service';

import { ThrottlerGuard } from '@nestjs/throttler';

import { APP_GUARD } from '@nestjs/core';

async function bootstrap() {
  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    );

  /*
    STATIC FILES
  */
  app.useStaticAssets(
    join(__dirname, '..', 'uploads'),
    {
      prefix: '/uploads/',
    },
  );

  /*
    GLOBAL PREFIX
  */
  app.setGlobalPrefix('api');

  /*
    CORS
  */
  app.enableCors();

  /*
    GLOBAL VALIDATION
  */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /*
    GLOBAL FILTERS
  */
  app.useGlobalFilters(
    new HttpExceptionFilter(),
  );

  /*
    GLOBAL INTERCEPTORS
  */
  const auditService =
    app.get(AuditService);

  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new AuditInterceptor(auditService),
  );

  /*
    SWAGGER
  */
  const config = new DocumentBuilder()
    .setTitle('Gym Management API')
    .setDescription(
      'Gym Management Backend API',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document =
    SwaggerModule.createDocument(
      app,
      config,
    );

  SwaggerModule.setup(
    'docs',
    app,
    document,
  );

  /*
    SERVER
  */
  await app.listen(3000);

  console.log(
    `🚀 Server running on port 3000`,
  );
}

bootstrap();