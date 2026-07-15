import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { ChangeMembershipPlanDto } from './dto/change-membership-plan.dto';
import { RenewMembershipDto } from './dto/renew-membership.dto';

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

  async getMyMembership(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    return this.prisma.membership.findFirst({
      where: { clientId: client.id, status: MembershipStatus.ACTIVE, endDate: { gte: new Date() } },
      include: { plan: true, activity: true },
      orderBy: { endDate: 'desc' },
    });
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

  async renewMembership(id: string, dto: RenewMembershipDto) {
    const membership = await this.getMembership(id);
    const months = dto.months ?? 1;

    const plan = dto.planId
      ? await this.prisma.membershipPlan.findUnique({ where: { id: dto.planId } })
      : membership.plan;
    if (!plan) throw new NotFoundException('Membership plan not found');
    if (!plan.isActive) throw new BadRequestException('Selected membership plan is not active');

    const currentEnd = membership.endDate < new Date() ? new Date() : membership.endDate;
    const startDate = dto.startDate ? new Date(dto.startDate) : currentEnd;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration * months);

    const membershipData = {
      planId: plan.id,
      startDate,
      endDate,
      months,
      status: MembershipStatus.ACTIVE,
      isActive: true,
    };

    if (!dto.paymentMethod) {
      // Courtesy renewal — extend dates only, no payment recorded.
      return this.prisma.membership.update({
        where: { id },
        data: membershipData,
        include: { client: true, plan: true },
      });
    }

    const baseAmount = Number(plan.price) * months;
    const discount = dto.discount ?? 0;
    const amount = baseAmount - discount;
    if (amount <= 0) {
      throw new BadRequestException('Calculated amount must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedMembership = await tx.membership.update({
        where: { id },
        data: membershipData,
        include: { client: true, plan: true },
      });

      await tx.payment.create({
        data: {
          membershipId: id,
          clientId: membership.clientId,
          amount,
          baseAmount,
          discount,
          months,
          paymentMethod: dto.paymentMethod!,
          transactionId: dto.transactionId ?? null,
          notes: dto.notes ?? null,
          status: PaymentStatus.APPROVED,
          paidAt: new Date(),
        },
      });

      return updatedMembership;
    });
  }

  async changePlan(id: string, dto: ChangeMembershipPlanDto) {
    const membership = await this.getMembership(id);

    const newPlan = await this.prisma.membershipPlan.findUnique({ where: { id: dto.planId } });
    if (!newPlan) throw new NotFoundException('Membership plan not found');
    if (!newPlan.isActive) throw new BadRequestException('Selected membership plan is not active');
    if (newPlan.id === membership.planId) {
      throw new BadRequestException('Membership is already on this plan');
    }

    // Switching plans starts a fresh billing period on the new plan, rather than
    // reusing whatever time was left on the old one (prices/durations differ).
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + newPlan.duration);

    return this.prisma.membership.update({
      where: { id },
      data: {
        planId: newPlan.id,
        startDate,
        endDate,
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

    // Wrap in transaction: find IDs then update ONLY those IDs
    // prevents race conditions and ensures email list matches what was actually expired
    const expired = await this.prisma.$transaction(async (tx) => {
      const toExpire = await tx.membership.findMany({
        where: { endDate: { lt: now }, status: MembershipStatus.ACTIVE },
        include: { client: { include: { user: true } }, plan: true },
      });

      if (toExpire.length === 0) return [];

      await tx.membership.updateMany({
        where: { id: { in: toExpire.map((m) => m.id) }, status: MembershipStatus.ACTIVE },
        data: { status: MembershipStatus.EXPIRED, isActive: false },
      });

      return toExpire;
    });

    if (expired.length === 0) return;

    // Send emails after transaction commits — external I/O stays outside the tx
    await Promise.allSettled(
      expired.map((m) =>
        this.emailService.sendMembershipExpired(
          m.client.user.email,
          `${m.client.firstName} ${m.client.lastName}`,
          m.plan.name,
          m.endDate,
        ),
      ),
    );

    this.logger.log(`Expired ${expired.length} memberships`);
  }
}
