import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { MercadopagoService } from './mercadopago.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateDirectPaymentDto } from './dto/create-direct-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { TransferPaymentDto } from './dto/transfer-payment.dto';
import { CreateCardPaymentDto } from './dto/create-card-payment.dto';

const MP_STATUS_MAP: Record<string, PaymentStatus> = {
  approved:   PaymentStatus.APPROVED,
  in_process: PaymentStatus.PENDING,
  pending:    PaymentStatus.PENDING,
  rejected:   PaymentStatus.REJECTED,
  cancelled:  PaymentStatus.REJECTED,
  refunded:   PaymentStatus.REFUNDED,
  charged_back: PaymentStatus.REFUNDED,
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly mercadopagoService: MercadopagoService,
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

  async createCashPayment(dto: CreateDirectPaymentDto) {
    return this.createPayment({ ...dto, paymentMethod: PaymentMethod.CASH });
  }

  async createTerminalPayment(dto: CreateDirectPaymentDto) {
    return this.createPayment({ ...dto, paymentMethod: PaymentMethod.TERMINAL });
  }

  async approvePayment(id: string, adminId: string) {
    // Atomic: only updates if STILL PENDING — eliminates the check-then-act race condition
    const result = await this.prisma.payment.updateMany({
      where: { id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.APPROVED, approvedBy: adminId, paidAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await this.prisma.payment.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Payment not found');
      throw new BadRequestException('Only PENDING payments can be approved');
    }

    const updated = await this.getPayment(id);
    const approvedClient = updated.membership.client;
    await this.emailService.sendPaymentApproved(
      approvedClient.user.email,
      `${approvedClient.firstName} ${approvedClient.lastName}`,
      Number(updated.amount),
      updated.membership.plan.name,
    );

    return updated;
  }

  async rejectPayment(id: string, adminId: string, reason?: string) {
    // Atomic: only updates if STILL PENDING — eliminates the check-then-act race condition
    const current = await this.prisma.payment.findUnique({
      where: { id },
      select: { id: true, status: true, notes: true },
    });
    if (!current) throw new NotFoundException('Payment not found');

    const result = await this.prisma.payment.updateMany({
      where: { id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.REJECTED,
        approvedBy: adminId,
        notes: reason ?? current.notes,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Only PENDING payments can be rejected');
    }

    const updated = await this.getPayment(id);
    const rejectedClient = updated.membership.client;
    await this.emailService.sendPaymentRejected(
      rejectedClient.user.email,
      `${rejectedClient.firstName} ${rejectedClient.lastName}`,
      Number(updated.amount),
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

  async getMyPayments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: { select: { id: true } } },
    });
    if (!user?.client) throw new NotFoundException('Client profile not found');

    return this.prisma.payment.findMany({
      where: { clientId: user.client.id },
      include: { membership: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createCardPayment(dto: CreateCardPaymentDto) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: dto.membershipId },
      include: { client: { include: { user: true } }, plan: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const appUrl = process.env.APP_URL;
    const mpResult = await this.mercadopagoService.createPayment({
      cardToken: dto.cardToken,
      amount: dto.amount,
      description: `Membresía ${membership.plan.name} — Oasis Training Center`,
      installments: dto.installments,
      paymentMethodId: dto.paymentMethodId,
      issuerId: dto.issuerId,
      payerEmail: dto.payerEmail,
      externalReference: dto.membershipId,
      notificationUrl: appUrl
        ? `${appUrl}/api/v1/payments/webhook/mercadopago`
        : undefined,
    });

    const status = MP_STATUS_MAP[mpResult.status ?? 'rejected'] ?? PaymentStatus.REJECTED;

    const payment = await this.prisma.payment.create({
      data: {
        membershipId: dto.membershipId,
        clientId: membership.clientId,
        amount: dto.amount,
        paymentMethod: PaymentMethod.CARD,
        status,
        transactionId: String(mpResult.id),
        notes: mpResult.status_detail ?? undefined,
        paidAt: status === PaymentStatus.APPROVED ? new Date() : null,
      },
      include: {
        membership: { include: { client: { include: { user: true } }, plan: true } },
      },
    });

    if (status === PaymentStatus.APPROVED) {
      await this.emailService.sendPaymentReceived(
        membership.client.user.email,
        `${membership.client.firstName} ${membership.client.lastName}`,
        dto.amount,
        'Tarjeta',
      );
    }

    return {
      payment,
      mpStatus: mpResult.status,
      mpStatusDetail: mpResult.status_detail,
    };
  }

  async handleMercadopagoWebhook(mpPaymentId: string) {
    const mpPayment = await this.mercadopagoService.getPayment(mpPaymentId);
    if (!mpPayment) return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: mpPaymentId },
      include: {
        membership: { include: { client: { include: { user: true } }, plan: true } },
      },
    });

    if (!payment) return { received: true };

    const newStatus = MP_STATUS_MAP[mpPayment.status ?? 'rejected'] ?? PaymentStatus.REJECTED;

    if (payment.status !== newStatus) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          paidAt: newStatus === PaymentStatus.APPROVED ? new Date() : undefined,
          notes: mpPayment.status_detail ?? undefined,
        },
      });

      if (newStatus === PaymentStatus.APPROVED) {
        const client = payment.membership.client;
        await this.emailService.sendPaymentApproved(
          client.user.email,
          `${client.firstName} ${client.lastName}`,
          Number(payment.amount),
          payment.membership.plan.name,
        );
      }

      this.logger.log(`Webhook: payment ${payment.id} → ${newStatus} (MP: ${mpPaymentId})`);
    }

    return { received: true };
  }
}
