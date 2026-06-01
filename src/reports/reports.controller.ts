import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { Role } from '@prisma/client';

import { ReportsService } from './reports.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  @Get('dashboard')
  getDashboardMetrics() {
    return this.reportsService.getDashboardMetrics();
  }

  @Get('revenue')
  getRevenueReport() {
    return this.reportsService.getRevenueReport();
  }

  @Get('attendance')
  getAttendanceReport() {
    return this.reportsService.getAttendanceReport();
  }

  @Get('expiring-memberships')
@Roles(Role.ADMIN)
getExpiringMemberships() {
  return this.reportsService.getExpiringMemberships();
}

@Get('inactive-clients')
@Roles(Role.ADMIN)
getInactiveClients() {
  return this.reportsService.getInactiveClients();
}
}