//import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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
import { envValidationSchema } from './config/env.validation';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';

import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
  ConfigModule.forRoot({
  isGlobal: true,

  validationSchema: envValidationSchema,
}),
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
  ],
})
export class AppModule
  implements NestModule
{
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('{*path}');
  }
}