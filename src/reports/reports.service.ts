import { Injectable } from '@nestjs/common';

import { PaymentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardMetrics() {
  const totalClients =
    await this.prisma.client.count();

  const activeMemberships =
    await this.prisma.membership.count({
      where: {
        isActive: true,
      },
    });

  const expiredMemberships =
    await this.prisma.membership.count({
      where: {
        endDate: {
          lt: new Date(),
        },
      },
    });

  const completedPayments =
    await this.prisma.payment.aggregate({
      _sum: {
        amount: true,
      },

      where: {
        status: 'COMPLETED',
      },
    });

  return {
    totalClients,

    activeMemberships,

    expiredMemberships,

    revenue:
      completedPayments._sum.amount || 0,
  };
}
  async getRevenueReport() {
    const payments =
      await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.COMPLETED,
        },

        include: {
          membership: {
            include: {
              client: true,
              plan: true,
            },
          },
        },

        orderBy: {
          paidAt: 'desc',
        },
      });

    return payments;
  }

  async getAttendanceReport() {
    return this.prisma.attendance.findMany({
      include: {
        client: true,
      },

      orderBy: {
        checkIn: 'desc',
      },
    });
  }

  async getExpiringMemberships() {
  const today = new Date();

  const nextWeek = new Date();

  nextWeek.setDate(
    today.getDate() + 7,
  );

  return this.prisma.membership.findMany({
    where: {
      endDate: {
        gte: today,
        lte: nextWeek,
      },

      isActive: true,
    },

    include: {
      client: true,

      plan: true,
    },

    orderBy: {
      endDate: 'asc',
    },
  });
}

async getInactiveClients() {
  const limitDate = new Date();

  limitDate.setDate(
    limitDate.getDate() - 30,
  );

  const recentAttendances =
    await this.prisma.attendance.findMany({
      where: {
        checkIn: {
          gte: limitDate,
        },
      },

      select: {
        clientId: true,
      },
    });

  const activeClientIds =
    recentAttendances.map(
      (attendance) =>
        attendance.clientId,
    );

  return this.prisma.client.findMany({
    where: {
      id: {
        notIn: activeClientIds,
      },
    },

    include: {
      memberships: true,
    },
  });
}
}