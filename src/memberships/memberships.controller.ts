import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role, MembershipStatus } from '@prisma/client';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';

@ApiTags('Memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post('plans')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create membership plan (Admin)' })
  createPlan(@Body() dto: CreateMembershipPlanDto) {
    return this.membershipsService.createPlan(dto);
  }

  @Get('plans')
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({ summary: 'Get all membership plans' })
  getPlans(@Query('active') active?: string) {
    return this.membershipsService.getPlans(active === 'true');
  }

  @Patch('plans/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update membership plan (Admin)' })
  updatePlan(@Param('id') id: string, @Body() dto: Partial<CreateMembershipPlanDto>) {
    return this.membershipsService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete membership plan (Admin)' })
  deletePlan(@Param('id') id: string) {
    return this.membershipsService.deletePlan(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create membership for client (Admin)' })
  createMembership(@Body() dto: CreateMembershipDto) {
    return this.membershipsService.createMembership(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all memberships (Admin)' })
  @ApiQuery({ name: 'status', enum: MembershipStatus, required: false })
  getMemberships(@Query('status') status?: MembershipStatus) {
    return this.membershipsService.getMemberships(status);
  }

  @Get('active')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get active memberships (Admin)' })
  getActive() {
    return this.membershipsService.getActiveMemberships();
  }

  @Get('expired')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get expired memberships (Admin)' })
  getExpired() {
    return this.membershipsService.getExpiredMemberships();
  }

  @Get('client/:clientId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get memberships by client (Admin)' })
  getClientMemberships(@Param('clientId') clientId: string) {
    return this.membershipsService.getClientMemberships(clientId);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get membership by ID (Admin)' })
  getMembership(@Param('id') id: string) {
    return this.membershipsService.getMembership(id);
  }

  @Patch(':id/suspend')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Suspend membership (Admin)' })
  suspend(@Param('id') id: string) {
    return this.membershipsService.suspendMembership(id);
  }

  @Patch(':id/renew')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Renew membership (Admin)' })
  renew(@Param('id') id: string, @Body('days') days?: number) {
    return this.membershipsService.renewMembership(id, days);
  }
}
