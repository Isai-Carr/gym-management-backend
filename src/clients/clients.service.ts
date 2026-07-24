import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { GetClientsDto } from './dto/get-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { RegisterClientFullDto } from './dto/register-client-full.dto';
import { generateTemporaryPassword } from '../common/utils/temporary-password.util';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateClientDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new BadRequestException('Email already in use');

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: Role.CLIENT,
        mustChangePassword: true,
        client: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
          },
        },
      },
      include: { client: true },
    });

    const loginUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/login`;
    const emailSent = await this.emailService.sendWelcome(
      dto.email,
      `${dto.firstName} ${dto.lastName}`,
      temporaryPassword,
      loginUrl,
    );

    const { password: _pwd, ...safeUser } = user;
    return {
      message: emailSent
        ? 'Client created successfully'
        : 'Client created successfully — WARNING: welcome email failed to send, share credentials manually',
      emailSent,
      ...(emailSent ? {} : { temporaryPassword }),
      user: safeUser,
    };
  }

  async registerFull(dto: RegisterClientFullDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already in use');

    const plan = await this.prisma.membershipPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Membership plan not found');
    if (!plan.isActive) throw new BadRequestException('Selected membership plan is not active');

    const months = dto.months ?? 1;
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration * months);

    const baseAmount = Number(plan.price) * months;
    const discount = dto.discount ?? 0;
    const amount = baseAmount - discount;
    if (amount <= 0) {
      throw new BadRequestException('Calculated amount must be greater than zero');
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const { user, membership, payment } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: Role.CLIENT,
          mustChangePassword: true,
          client: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
            },
          },
        },
        include: { client: true },
      });

      const membership = await tx.membership.create({
        data: {
          clientId: user.client!.id,
          planId: dto.planId,
          activityId: dto.activityId ?? null,
          startDate,
          endDate,
          months,
          status: 'ACTIVE',
        },
        include: { plan: true },
      });

      const payment = await tx.payment.create({
        data: {
          membershipId: membership.id,
          clientId: user.client!.id,
          amount,
          baseAmount,
          discount,
          months,
          paymentMethod: dto.paymentMethod,
          transactionId: dto.transactionId ?? null,
          notes: dto.notes ?? null,
          status: PaymentStatus.APPROVED,
          paidAt: new Date(),
        },
      });

      return { user, membership, payment };
    });

    const loginUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/login`;
    const emailSent = await this.emailService.sendWelcome(
      dto.email,
      `${dto.firstName} ${dto.lastName}`,
      temporaryPassword,
      loginUrl,
    );

    const { password: _pwd, ...safeUser } = user;
    return {
      message: emailSent
        ? 'Client registered successfully'
        : 'Client registered successfully — WARNING: welcome email failed to send, share credentials manually',
      emailSent,
      ...(emailSent ? {} : { temporaryPassword }),
      user: safeUser,
      membership,
      payment,
    };
  }

  private readonly ALLOWED_SORT_FIELDS = new Set(['createdAt', 'firstName', 'lastName', 'updatedAt']);

  async findAll(query: GetClientsDto) {
    const { page = 1, limit = 10, search, order = 'desc' } = query;
    const sortBy = this.ALLOWED_SORT_FIELDS.has(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const skip = (page - 1) * limit;

    const where = {
      user: { isActive: true },
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { user: { select: { email: true, role: true, isActive: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, role: true, isActive: true, createdAt: true } },
        memberships: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const client = await this.findOne(id);
    await this.prisma.user.update({
      where: { id: client.userId },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { message: 'Client deactivated successfully' };
  }

  async getClientPayments(clientId: string) {
    await this.findOne(clientId);
    return this.prisma.payment.findMany({
      where: { membership: { clientId } },
      include: { membership: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClientAttendance(clientId: string) {
    await this.findOne(clientId);
    return this.prisma.attendance.findMany({
      where: { clientId },
      include: { activity: true },
      orderBy: { checkIn: 'desc' },
    });
  }

  async getMyStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: { select: { id: true } } },
    });
    if (!user?.client) throw new NotFoundException('Client profile not found');

    const clientId = user.client.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [classesThisMonth, prsThisMonth, recentAttendances] = await Promise.all([
      this.prisma.attendance.count({
        where: { clientId, checkIn: { gte: startOfMonth } },
      }),
      this.prisma.personalRecord.count({
        where: { client: { userId }, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.attendance.findMany({
        where: { clientId },
        select: { checkIn: true },
        orderBy: { checkIn: 'desc' },
        take: 365,
      }),
    ]);

    return {
      classesThisMonth,
      prsThisMonth,
      currentStreak: this.calculateStreak(recentAttendances.map((a) => a.checkIn)),
    };
  }

  private calculateStreak(checkIns: Date[]): number {
    if (checkIns.length === 0) return 0;

    const MS_PER_DAY = 86_400_000;
    const toDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    const uniqueDays = [...new Set(checkIns.map(toDay))].sort((a, b) => b - a);

    const todayMs = toDay(new Date());
    const yesterdayMs = todayMs - MS_PER_DAY;

    // Streak breaks if the last session was before yesterday
    if (uniqueDays[0] < yesterdayMs) return 0;

    let streak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (uniqueDays[i - 1] - uniqueDays[i] === MS_PER_DAY) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
}
