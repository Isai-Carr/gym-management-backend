import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

import { PaymentsService } from './payments.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  createPayment(
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  getPayments() {
    return this.paymentsService.getPayments();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  getPayment(@Param('id') id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updatePaymentStatus(
    @Param('id') id: string,

    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.updatePaymentStatus(
      id,
      dto,
    );
  }
}