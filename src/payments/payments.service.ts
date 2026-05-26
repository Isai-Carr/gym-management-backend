import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async createPayment(dto: CreatePaymentDto) {
    return this.prisma.payment.create({
      data: {
        membershipId: dto.membershipId,

        amount: dto.amount,

        paymentMethod: dto.paymentMethod,
      },

      include: {
        membership: {
          include: {
            client: true,
            plan: true,
          },
        },
      },
    });
  }

  async getPayments() {
    return this.prisma.payment.findMany({
      include: {
        membership: {
          include: {
            client: true,
            plan: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPayment(id: string) {
    const payment =
      await this.prisma.payment.findUnique({
        where: {
          id,
        },

        include: {
          membership: {
            include: {
              client: true,
              plan: true,
            },
          },
        },
      });

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    return payment;
  }

  async updatePaymentStatus(
    id: string,
    dto: UpdatePaymentStatusDto,
  ) {
    await this.getPayment(id);

    return this.prisma.payment.update({
      where: {
        id,
      },

      data: {
        status: dto.status,

        transactionId: dto.transactionId,

        paidAt:
          dto.status === PaymentStatus.COMPLETED
            ? new Date()
            : null,
      },
    });
  }
}