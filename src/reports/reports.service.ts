import { Injectable } from '@nestjs/common';
import { PaymentStatus, InventoryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // "2026-07-24" parses as UTC midnight, so using it directly as an `lte` bound
  // excludes almost all of that day. Mirrors the local y/m/d pattern already used
  // in classes.service.ts's getSchedule() for the same kind of date-only filter.
  private endOfDay(dateStr: string): Date {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  async getDashboardMetrics() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalClients,
      newClientsThisMonth,
      newClientsLastMonth,
      activeMemberships,
      totalMemberships,
      expiredMemberships,
      pendingPayments,
      revenueThisMonth,
      revenueLastMonth,
      totalEquipment,
      membershipsByPlanRaw,
    ] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { createdAt: { gte: startOfThisMonth } } }),
      this.prisma.client.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      this.prisma.membership.count({ where: { status: 'ACTIVE', endDate: { gte: now } } }),
      this.prisma.membership.count(),
      this.prisma.membership.count({ where: { OR: [{ status: 'EXPIRED' }, { endDate: { lt: now } }] } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.APPROVED, paidAt: { gte: startOfThisMonth } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.APPROVED, paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      this.prisma.inventory.count({ where: { type: 'EQUIPMENT' } }),
      this.prisma.membership.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE', endDate: { gte: now } },
        _count: { id: true },
      }),
    ]);

    const planIds = membershipsByPlanRaw.map((b) => b.planId).filter(Boolean) as string[];
    const plans = await this.prisma.membershipPlan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true },
    });
    const planMap = new Map(plans.map((p) => [p.id, p.name]));

    const membershipsByPlan = membershipsByPlanRaw.map((b) => ({
      planId: b.planId,
      planName: planMap.get(b.planId ?? '') ?? 'Sin plan',
      count: b._count.id,
    }));

    const revenueThisMonthTotal = revenueThisMonth._sum.amount?.toNumber() ?? 0;
    const revenueLastMonthTotal = revenueLastMonth._sum.amount?.toNumber() ?? 0;
    const revenueDeltaPct =
      revenueLastMonthTotal > 0
        ? +((((revenueThisMonthTotal - revenueLastMonthTotal) / revenueLastMonthTotal) * 100).toFixed(1))
        : null;

    const newClientsLast30Days = await this.prisma.client.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    return {
      totalClients,
      newClientsThisMonth,
      newClientsLastMonth,
      newClientsLast30Days,
      activeMemberships,
      totalMemberships,
      activeMembershipsPercentage:
        totalMemberships > 0 ? +((activeMemberships / totalMemberships) * 100).toFixed(1) : 0,
      expiredMemberships,
      pendingPayments,
      revenueThisMonth: revenueThisMonthTotal,
      revenueLastMonth: revenueLastMonthTotal,
      revenueDeltaPct,
      totalEquipment,
      membershipsByPlan,
    };
  }

  async getMonthlyIncomeChart(months = 12) {
    const now = new Date();
    const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    const ranges = Array.from({ length: months }, (_, idx) => {
      const i = months - 1 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: labels[d.getMonth()],
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      };
    });

    const aggregates = await Promise.all(
      ranges.map((r) =>
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: PaymentStatus.APPROVED, paidAt: { gte: r.start, lte: r.end } },
        }),
      ),
    );

    return ranges.map((r, idx) => ({
      year: r.year,
      month: r.month,
      label: r.label,
      total: aggregates[idx]._sum.amount?.toNumber() ?? 0,
    }));
  }

  async getRecentActivity(limit = 20) {
    const [recentPayments, recentMemberships, recentAttendances] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.APPROVED },
        include: { membership: { include: { client: true, plan: true } } },
        orderBy: { paidAt: 'desc' },
        take: limit,
      }),
      this.prisma.membership.findMany({
        include: { client: true, plan: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.attendance.findMany({
        include: { client: true, activity: true },
        orderBy: { checkIn: 'desc' },
        take: limit,
      }),
    ]);

    const feed = [
      ...recentPayments.map((p) => ({
        type: 'payment' as const,
        clientName: `${p.membership.client.firstName} ${p.membership.client.lastName}`,
        description: `Pago aprobado • ${p.membership.plan.name}`,
        amount: p.amount ? Number(p.amount) : null,
        timestamp: p.paidAt ?? p.createdAt,
      })),
      ...recentMemberships.map((m) => ({
        type: 'membership' as const,
        clientName: `${m.client.firstName} ${m.client.lastName}`,
        description: `Nueva membresía • ${m.plan.name}`,
        amount: null,
        timestamp: m.createdAt,
      })),
      ...recentAttendances.map((a) => ({
        type: 'attendance' as const,
        clientName: `${a.client.firstName} ${a.client.lastName}`,
        description: `Check-in${a.activity ? ` • ${a.activity.name}` : ''}`,
        amount: null,
        timestamp: a.checkIn,
      })),
    ];

    return feed
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getMonthlyIncome(year?: number, month?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    const start = new Date(targetYear, targetMonth - 1, 1);
    const end = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const where = {
      status: PaymentStatus.APPROVED,
      paidAt: { gte: start, lte: end },
    };

    const [payments, aggregated] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: { membership: { include: { client: true, plan: true } } },
        orderBy: { paidAt: 'asc' },
        take: 500,
      }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where }),
    ]);

    return {
      year: targetYear,
      month: targetMonth,
      total: aggregated._sum.amount?.toNumber() ?? 0,
      count: payments.length,
      payments,
    };
  }

  async getRevenueByPeriod(startDate: string, endDate: string) {
    const where = {
      status: PaymentStatus.APPROVED,
      paidAt: { gte: new Date(startDate), lte: this.endOfDay(endDate) },
    };

    const [payments, aggregated] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: { membership: { include: { client: true, plan: true } } },
        orderBy: { paidAt: 'asc' },
        take: 1000,
      }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where }),
    ]);

    return {
      startDate,
      endDate,
      total: aggregated._sum.amount?.toNumber() ?? 0,
      count: payments.length,
      payments,
    };
  }

  async getRevenueReport() {
    return this.prisma.payment.findMany({
      where: { status: PaymentStatus.APPROVED },
      include: { membership: { include: { client: true, plan: true } } },
      orderBy: { paidAt: 'desc' },
      take: 1000,
    });
  }

  async getAttendanceReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.checkIn = {};
      if (startDate) where.checkIn.gte = new Date(startDate);
      if (endDate) where.checkIn.lte = this.endOfDay(endDate);
    }

    return this.prisma.attendance.findMany({
      where,
      include: { client: true, activity: true },
      orderBy: { checkIn: 'desc' },
      take: 1000,
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
      take: 500,
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

    // Use Prisma relation filter (none) instead of loading IDs into JS then NOT IN
    return this.prisma.client.findMany({
      where: {
        attendances: {
          none: { checkIn: { gte: limitDate } },
        },
      },
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
    return this.prisma.activity.findMany({
      include: { _count: { select: { memberships: true, attendances: true } } },
    });
  }

  async getPaymentsReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = this.endOfDay(endDate);
    }

    return this.prisma.payment.findMany({
      where,
      include: { membership: { include: { client: true, plan: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }
}
