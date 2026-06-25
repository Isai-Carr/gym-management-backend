import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
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
      take: 200,
    });
  }

  async findUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
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

  @Cron('0 9 * * *')
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

    if (expiringMemberships.length === 0) {
      return { processed: 0, sent: 0 };
    }

    // Batch-check which users already received a warning in the last 20 hours
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 20);

    const userIds = expiringMemberships.map((m) => m.client.userId);

    const alreadyNotified = await this.prisma.notification.findMany({
      where: {
        userId: { in: userIds },
        type: NotificationType.EXPIRY_WARNING,
        createdAt: { gte: cutoff },
      },
      select: { userId: true },
    });

    const notifiedSet = new Set(alreadyNotified.map((n) => n.userId));

    const toNotify = expiringMemberships.filter((m) => !notifiedSet.has(m.client.userId));

    if (toNotify.length === 0) {
      return { processed: expiringMemberships.length, sent: 0 };
    }

    // Batch-insert all notifications in one query
    await this.prisma.notification.createMany({
      data: toNotify.map((m) => ({
        userId: m.client.userId,
        title: 'Tu membresía está por vencer',
        message: `Tu membresía "${m.plan.name}" vence el ${m.endDate.toLocaleDateString('es-MX')}`,
        type: NotificationType.EXPIRY_WARNING,
      })),
      skipDuplicates: true,
    });

    // Send emails in parallel (external I/O — keep parallel but cap concurrency)
    const emailResults = await Promise.allSettled(
      toNotify.map((m) =>
        this.emailService.sendMembershipExpiring(
          m.client.user.email,
          `${m.client.firstName} ${m.client.lastName}`,
          m.plan.name,
          m.endDate,
        ),
      ),
    );

    const sent = emailResults.filter((r) => r.status === 'fulfilled').length;
    return { processed: expiringMemberships.length, sent };
  }

  async sendEmailNotification(userId: string, subject: string, message: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.notification.create({
      data: { userId, title: subject, message, type: NotificationType.MANUAL },
    });

    await this.emailService.sendMail(user.email, subject, `<p>${message}</p>`);
    return { message: 'Notification sent successfully' };
  }
}
