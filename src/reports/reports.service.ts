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

          endDate: {
            gt: new Date(),
          },
        },
      });

    const completedPayments =
      await this.prisma.payment.count({
        where: {
          status: PaymentStatus.COMPLETED,
        },
      });

    const totalRevenue =
      await this.prisma.payment.aggregate({
        _sum: {
          amount: true,
        },

        where: {
          status: PaymentStatus.COMPLETED,
        },
      });

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const todayAttendance =
      await this.prisma.attendance.count({
        where: {
          checkIn: {
            gte: today,
          },
        },
      });

    return {
      totalClients,

      activeMemberships,

      completedPayments,

      totalRevenue:
        totalRevenue._sum.amount || 0,

      todayAttendance,
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
}