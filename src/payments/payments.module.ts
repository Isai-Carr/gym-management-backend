import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MercadopagoService } from './mercadopago.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadopagoService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
