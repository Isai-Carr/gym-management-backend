import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

import { MembershipsService } from './memberships.service';

import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';

@Controller('memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembershipsController {
  constructor(
    private readonly membershipsService: MembershipsService,
  ) {}

  @Post('plans')
  @Roles(Role.ADMIN)
  createPlan(
    @Body() dto: CreateMembershipPlanDto,
  ) {
    return this.membershipsService.createPlan(dto);
  }

  @Get('plans')
  getPlans() {
    return this.membershipsService.getPlans();
  }

  @Post()
  @Roles(Role.ADMIN)
  createMembership(
    @Body() dto: CreateMembershipDto,
  ) {
    return this.membershipsService.createMembership(dto);
  }

  @Get()
  getMemberships() {
    return this.membershipsService.getMemberships();
  }

  @Get(':id')
  getMembership(@Param('id') id: string) {
    return this.membershipsService.getMembership(id);
  }
}