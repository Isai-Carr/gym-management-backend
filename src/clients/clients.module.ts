import { Module } from '@nestjs/common';

import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
  ],

  controllers: [
    ClientsController,
  ],

  providers: [
    ClientsService,
  ],
})
export class ClientsModule {}