import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { TransferPaymentDto } from './dto/transfer-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createPayment(dto: CreatePaymentDto) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: dto.membershipId },
      include: { client: { include: { user: true } }, plan: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const payment = await this.prisma.payment.create({
      data: {
        membershipId: dto.membershipId,
        clientId: membership.clientId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        notes: dto.notes,
        status: PaymentStatus.APPROVED,
        paidAt: new Date(),
      },
      include: {
        membership: { include: { client: { include: { user: true } }, plan: true } },
      },
    });

    await this.emailService.sendPaymentReceived(
      membership.client.user.email,
      `${membership.client.firstName} ${membership.client.lastName}`,
      dto.amount,
      dto.paymentMethod,
    );

    return payment;
  }

  async createTransferPayment(dto: TransferPaymentDto, voucherPath?: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: dto.membershipId },
      include: { client: { include: { user: true } }, plan: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    return this.prisma.payment.create({
      data: {
        membershipId: dto.membershipId,
        clientId: membership.clientId,
        amount: dto.amount,
        paymentMethod: PaymentMethod.TRANSFER,
        voucherUrl: voucherPath ?? null,
        notes: dto.notes,
        status: PaymentStatus.PENDING,
      },
      include: {
        membership: { include: { client: true, plan: true } },
      },
    });
  }

  async createCashPayment(dto: CreatePaymentDto) {
    return this.createPayment({ ...dto, paymentMethod: PaymentMethod.CASH });
  }

  async createTerminalPayment(dto: CreatePaymentDto) {
    return this.createPayment({ ...dto, paymentMethod: PaymentMethod.TERMINAL });
  }

  async approvePayment(id: string, adminId: string) {
    const payment = await this.getPayment(id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only PENDING payments can be approved');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.APPROVED,
        approvedBy: adminId,
        paidAt: new Date(),
      },
      include: {
        membership: { include: { client: { include: { user: true } }, plan: true } },
      },
    });

    const approvedClient = updated.membership.client;
    await this.emailService.sendPaymentApproved(
      approvedClient.user.email,
      `${approvedClient.firstName} ${approvedClient.lastName}`,
      updated.amount,
      updated.membership.plan.name,
    );

    return updated;
  }

  async rejectPayment(id: string, adminId: string, reason?: string) {
    const payment = await this.getPayment(id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only PENDING payments can be rejected');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.REJECTED,
        approvedBy: adminId,
        notes: reason ?? payment.notes,
      },
      include: {
        membership: { include: { client: { include: { user: true } }, plan: true } },
      },
    });

    const rejectedClient = updated.membership.client;
    await this.emailService.sendPaymentRejected(
      rejectedClient.user.email,
      `${rejectedClient.firstName} ${rejectedClient.lastName}`,
      updated.amount,
      reason,
    );

    return updated;
  }

  async getPayments(status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: status ? { status } : undefined,
      include: {
        membership: { include: { client: true, plan: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        membership: { include: { client: { include: { user: true } }, plan: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async updatePaymentStatus(id: string, dto: UpdatePaymentStatusDto) {
    await this.getPayment(id);

    return this.prisma.payment.update({
      where: { id },
      data: {
        status: dto.status,
        transactionId: dto.transactionId,
        notes: dto.notes,
        paidAt: dto.status === PaymentStatus.APPROVED ? new Date() : undefined,
      },
    });
  }

  async getPendingPayments() {
    return this.getPayments(PaymentStatus.PENDING);
  }

  async getClientPayments(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.payment.findMany({
      where: { membership: { clientId } },
      include: { membership: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
