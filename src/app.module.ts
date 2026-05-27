import { ConfigModule } from '@nestjs/config';

import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';

import { APP_GUARD } from '@nestjs/core';

import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';


import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PaymentsModule } from './payments/payments.module';
import { ReservationsModule } from './reservations/reservations.module';
import { AttendanceModule } from './attendance/attendance.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { AuditModule } from './audit/audit.module';

import { LoggerMiddleware } from './common/middleware/logger.middleware';

import { envValidationSchema } from './config/env.validation';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),

    PrismaModule,

    AuthModule,
    UsersModule,
    ClientsModule,
    MembershipsModule,
    PaymentsModule,
    ReservationsModule,
    AttendanceModule,
    InventoryModule,
    ReportsModule,
    NotificationsModule,
    UploadsModule,
    AuditModule,
    EmailModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule
  implements NestModule
{
  configure(
    consumer: MiddlewareConsumer,
  ) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('{*path}');
  }
}