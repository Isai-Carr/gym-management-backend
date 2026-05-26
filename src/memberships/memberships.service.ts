import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  async createPlan(dto: CreateMembershipPlanDto) {
    return this.prisma.membershipPlan.create({
      data: dto,
    });
  }

  async getPlans() {
    return this.prisma.membershipPlan.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createMembership(
    dto: CreateMembershipDto,
  ) {
    return this.prisma.membership.create({
      data: {
        clientId: dto.clientId,

        planId: dto.planId,

        startDate: new Date(dto.startDate),

        endDate: new Date(dto.endDate),
      },

      include: {
        client: true,
        plan: true,
      },
    });
  }

  async getMemberships() {
    return this.prisma.membership.findMany({
      include: {
        client: true,
        plan: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getMembership(id: string) {
    const membership =
      await this.prisma.membership.findUnique({
        where: {
          id,                                                                   
        },

        include: {
          client: true,
          plan: true,
        },
      });

    if (!membership) {
      throw new NotFoundException(
        'Membership not found',
      );
    }

    return membership;
  }
}