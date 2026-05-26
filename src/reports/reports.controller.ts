import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  @Get('dashboard')
  @Roles(Role.ADMIN)
  getDashboardMetrics() {
    return this.reportsService.getDashboardMetrics();
  }

  @Get('revenue')
  @Roles(Role.ADMIN)
  getRevenueReport() {
    return this.reportsService.getRevenueReport();
  }

  @Get('attendance')
  @Roles(Role.ADMIN)
  getAttendanceReport() {
    return this.reportsService.getAttendanceReport();
  }
}