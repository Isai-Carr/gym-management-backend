import { Injectable } from '@nestjs/common';
import { PaymentStatus, InventoryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const [
      totalClients,
      activeMemberships,
      expiredMemberships,
      pendingPayments,
      revenueResult,
      totalEquipment,
    ] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.membership.count({ where: { status: 'ACTIVE', endDate: { gte: new Date() } } }),
      this.prisma.membership.count({ where: { OR: [{ status: 'EXPIRED' }, { endDate: { lt: new Date() } }] } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.APPROVED },
      }),
      this.prisma.inventory.count({ where: { type: 'EQUIPMENT' } }),
    ]);

    return {
      totalClients,
      activeMemberships,
      expiredMemberships,
      pendingPayments,
      totalRevenue: revenueResult._sum.amount ?? 0,
      totalEquipment,
    };
  }

  async getMonthlyIncome(year?: number, month?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    const start = new Date(targetYear, targetMonth - 1, 1);
    const end = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.APPROVED,
        paidAt: { gte: start, lte: end },
      },
      include: { membership: { include: { client: true, plan: true } } },
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      year: targetYear,
      month: targetMonth,
      total,
      count: payments.length,
      payments,
    };
  }

  async getRevenueByPeriod(startDate: string, endDate: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.APPROVED,
        paidAt: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      include: { membership: { include: { client: true, plan: true } } },
      orderBy: { paidAt: 'asc' },
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    return { startDate, endDate, total, count: payments.length, payments };
  }

  async getRevenueReport() {
    return this.prisma.payment.findMany({
      where: { status: PaymentStatus.APPROVED },
      include: { membership: { include: { client: true, plan: true } } },
      orderBy: { paidAt: 'desc' },
    });
  }

  async getAttendanceReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.checkIn = {};
      if (startDate) where.checkIn.gte = new Date(startDate);
      if (endDate) where.checkIn.lte = new Date(endDate);
    }

    return this.prisma.attendance.findMany({
      where,
      include: { client: true, activity: true },
      orderBy: { checkIn: 'desc' },
    });
  }

  async getExpiringMemberships(days = 7) {
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + days);

    return this.prisma.membership.findMany({
      where: { endDate: { gte: today, lte: future }, status: 'ACTIVE' },
      include: { client: { include: { user: true } }, plan: true },
      orderBy: { endDate: 'asc' },
    });
  }

  async getActiveMemberships() {
    return this.prisma.membership.findMany({
      where: { status: 'ACTIVE', endDate: { gte: new Date() } },
      include: { client: true, plan: true, activity: true },
      orderBy: { endDate: 'asc' },
    });
  }

  async getExpiredMemberships() {
    return this.prisma.membership.findMany({
      where: { OR: [{ status: 'EXPIRED' }, { endDate: { lt: new Date() } }] },
      include: { client: true, plan: true },
      orderBy: { endDate: 'desc' },
    });
  }

  async getActiveClients() {
    return this.prisma.client.findMany({
      where: { memberships: { some: { status: 'ACTIVE', endDate: { gte: new Date() } } } },
      include: { memberships: { where: { status: 'ACTIVE' } } },
    });
  }

  async getInactiveClients() {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 30);

    const recentClientIds = await this.prisma.attendance.findMany({
      where: { checkIn: { gte: limitDate } },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const activeIds = recentClientIds.map((a) => a.clientId);

    return this.prisma.client.findMany({
      where: { id: { notIn: activeIds } },
      include: { memberships: { where: { status: 'ACTIVE' } } },
    });
  }

  async getPendingPayments() {
    return this.prisma.payment.findMany({
      where: { status: PaymentStatus.PENDING },
      include: { membership: { include: { client: true, plan: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getLowStockItems() {
    return this.prisma.inventory.findMany({
      where: { quantity: { lte: 5 } },
      orderBy: { quantity: 'asc' },
    });
  }

  async getEquipmentInMaintenance() {
    return this.prisma.inventory.findMany({
      where: { status: InventoryStatus.IN_MAINTENANCE },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getUsersByActivity() {
    const activities = await this.prisma.activity.findMany({
      include: { _count: { select: { memberships: true, attendances: true } } },
    });
    return activities;
  }

  async getPaymentsReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    return this.prisma.payment.findMany({
      where,
      include: { membership: { include: { client: true, plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
