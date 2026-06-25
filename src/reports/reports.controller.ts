import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard KPIs: totals, revenue, active memberships (Admin)' })
  getDashboardMetrics() {
    return this.reportsService.getDashboardMetrics();
  }

  @Get('monthly-income')
  @ApiOperation({ summary: 'Monthly income report (Admin)' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  getMonthlyIncome(@Query('year') year?: string, @Query('month') month?: string) {
    return this.reportsService.getMonthlyIncome(year ? +year : undefined, month ? +month : undefined);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue report with optional date range (Admin)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getRevenueReport(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    if (startDate && endDate) return this.reportsService.getRevenueByPeriod(startDate, endDate);
    return this.reportsService.getRevenueReport();
  }

  @Get('active-memberships')
  @ApiOperation({ summary: 'Active memberships report (Admin)' })
  getActiveMemberships() {
    return this.reportsService.getActiveMemberships();
  }

  @Get('expired-memberships')
  @ApiOperation({ summary: 'Expired memberships report (Admin)' })
  getExpiredMemberships() {
    return this.reportsService.getExpiredMemberships();
  }

  @Get('expiring-memberships')
  @ApiOperation({ summary: 'Memberships expiring soon (Admin)' })
  @ApiQuery({ name: 'days', required: false })
  getExpiringMemberships(@Query('days') days?: string) {
    return this.reportsService.getExpiringMemberships(days ? +days : 7);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance report with optional date range (Admin)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAttendanceReport(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportsService.getAttendanceReport(startDate, endDate);
  }

  @Get('active-clients')
  @ApiOperation({ summary: 'Active clients report (Admin)' })
  getActiveClients() {
    return this.reportsService.getActiveClients();
  }

  @Get('inactive-clients')
  @ApiOperation({ summary: 'Inactive clients report (Admin)' })
  getInactiveClients() {
    return this.reportsService.getInactiveClients();
  }

  @Get('payments')
  @ApiOperation({ summary: 'Payments report (Admin)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getPaymentsReport(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportsService.getPaymentsReport(startDate, endDate);
  }

  @Get('pending-payments')
  @ApiOperation({ summary: 'Pending payment transfers (Admin)' })
  getPendingPayments() {
    return this.reportsService.getPendingPayments();
  }

  @Get('monthly-income-chart')
  @ApiOperation({ summary: 'Monthly income totals for last N months — for line chart (Admin)' })
  @ApiQuery({ name: 'months', required: false, description: 'Number of months back (default 12)' })
  getMonthlyIncomeChart(@Query('months') months?: string) {
    return this.reportsService.getMonthlyIncomeChart(months ? +months : 12);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Recent activity feed: payments, memberships, check-ins (Admin)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max events to return (default 20)' })
  getRecentActivity(@Query('limit') limit?: string) {
    return this.reportsService.getRecentActivity(limit ? +limit : 20);
  }

  @Get('users-by-activity')
  @ApiOperation({ summary: 'Users per activity (Admin)' })
  getUsersByActivity() {
    return this.reportsService.getUsersByActivity();
  }

  @Get('equipment-maintenance')
  @ApiOperation({ summary: 'Equipment in maintenance (Admin)' })
  getEquipmentInMaintenance() {
    return this.reportsService.getEquipmentInMaintenance();
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Low stock items (Admin)' })
  getLowStockItems() {
    return this.reportsService.getLowStockItems();
  }
}
