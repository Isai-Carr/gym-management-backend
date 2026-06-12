import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createPlan(dto: CreateMembershipPlanDto) {
    return this.prisma.membershipPlan.create({ data: dto });
  }

  async getPlans(onlyActive = false) {
    return this.prisma.membershipPlan.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async updatePlan(id: string, dto: Partial<CreateMembershipPlanDto>) {
    const plan = await this.prisma.membershipPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Membership plan not found');
    return this.prisma.membershipPlan.update({ where: { id }, data: dto });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.membershipPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Membership plan not found');

    const membershipCount = await this.prisma.membership.count({ where: { planId: id } });
    if (membershipCount > 0) {
      throw new BadRequestException(`Cannot delete plan: ${membershipCount} membership(s) are linked to it.`);
    }

    return this.prisma.membershipPlan.delete({ where: { id } });
  }

  async createMembership(dto: CreateMembershipDto) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const plan = await this.prisma.membershipPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Membership plan not found');

    return this.prisma.membership.create({
      data: {
        clientId: dto.clientId,
        planId: dto.planId,
        activityId: dto.activityId ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: MembershipStatus.ACTIVE,
        isActive: true,
      },
      include: { client: true, plan: true, activity: true },
    });
  }

  async getMemberships(status?: MembershipStatus) {
    return this.prisma.membership.findMany({
      where: status ? { status } : undefined,
      include: { client: true, plan: true, activity: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveMemberships() {
    return this.prisma.membership.findMany({
      where: { status: MembershipStatus.ACTIVE, endDate: { gte: new Date() } },
      include: { client: true, plan: true },
      orderBy: { endDate: 'asc' },
    });
  }

  async getExpiredMemberships() {
    return this.prisma.membership.findMany({
      where: {
        OR: [
          { status: MembershipStatus.EXPIRED },
          { endDate: { lt: new Date() } },
        ],
      },
      include: { client: true, plan: true },
      orderBy: { endDate: 'desc' },
    });
  }

  async getMembership(id: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
      include: { client: true, plan: true, activity: true, payments: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return membership;
  }

  async suspendMembership(id: string) {
    await this.getMembership(id);
    return this.prisma.membership.update({
      where: { id },
      data: { status: MembershipStatus.SUSPENDED, isActive: false },
    });
  }

  async renewMembership(id: string, additionalDays?: number) {
    const membership = await this.getMembership(id);
    const plan = membership.plan;
    const days = additionalDays ?? plan.duration;

    const currentEnd = membership.endDate < new Date() ? new Date() : membership.endDate;
    const newEndDate = new Date(currentEnd);
    newEndDate.setDate(newEndDate.getDate() + days);

    return this.prisma.membership.update({
      where: { id },
      data: {
        endDate: newEndDate,
        status: MembershipStatus.ACTIVE,
        isActive: true,
      },
      include: { client: true, plan: true },
    });
  }

  async getClientMemberships(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.membership.findMany({
      where: { clientId },
      include: { plan: true, activity: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireMembershipsJob() {
    const now = new Date();

    const toExpire = await this.prisma.membership.findMany({
      where: { endDate: { lt: now }, status: MembershipStatus.ACTIVE },
      include: { client: { include: { user: true } }, plan: true },
    });

    if (toExpire.length === 0) return;

    await this.prisma.membership.updateMany({
      where: { endDate: { lt: now }, status: MembershipStatus.ACTIVE },
      data: { status: MembershipStatus.EXPIRED, isActive: false },
    });

    for (const m of toExpire) {
      await this.emailService.sendMembershipExpired(
        m.client.user.email,
        `${m.client.firstName} ${m.client.lastName}`,
        m.plan.name,
        m.endDate,
      );
    }

    this.logger.log(`Expired ${toExpire.length} memberships`);
  }
}
