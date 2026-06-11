import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  async findAll(userId?: string) {
    return this.prisma.notification.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  @Cron('0 9 * * *') // every day at 09:00
  async dailyExpirationWarningJob() {
    const result = await this.sendExpirationWarning();
    this.logger.log(`Daily expiry warning: sent ${result.sent}/${result.processed}`);
  }

  async sendExpirationWarning() {
    const today = new Date();
    const in7Days = new Date();
    in7Days.setDate(today.getDate() + 7);

    const expiringMemberships = await this.prisma.membership.findMany({
      where: {
        endDate: { gte: today, lte: in7Days },
        status: 'ACTIVE',
      },
      include: { client: { include: { user: true } }, plan: true },
    });

    const results = await Promise.allSettled(
      expiringMemberships.map(async (membership) => {
        const client = membership.client;

        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 20);
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: client.userId,
            type: 'EXPIRY_WARNING',
            createdAt: { gte: cutoff },
          },
        });
        if (existing) return client.user.email;

        await this.prisma.notification.create({
          data: {
            userId: client.userId,
            title: 'Tu membresía está por vencer',
            message: `Tu membresía "${membership.plan.name}" vence el ${membership.endDate.toLocaleDateString('es-MX')}`,
            type: 'EXPIRY_WARNING',
          },
        });

        await this.emailService.sendMembershipExpiring(
          client.user.email,
          `${client.firstName} ${client.lastName}`,
          membership.plan.name,
          membership.endDate,
        );

        return client.user.email;
      }),
    );

    return {
      processed: expiringMemberships.length,
      sent: results.filter((r) => r.status === 'fulfilled').length,
    };
  }

  async sendEmailNotification(userId: string, subject: string, message: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.notification.create({
      data: { userId, title: subject, message, type: 'MANUAL' },
    });

    await this.emailService.sendMail(user.email, subject, `<p>${message}</p>`);
    return { message: 'Notification sent successfully' };
  }
}
