import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PersonalRecordsService } from './personal-records.service';
import { CreatePersonalRecordDto } from './dto/create-personal-record.dto';
import { UpdatePersonalRecordDto } from './dto/update-personal-record.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Personal Records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('personal-records')
export class PersonalRecordsController {
  constructor(private readonly prService: PersonalRecordsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new personal record (Client)' })
  create(@Request() req: any, @Body() dto: CreatePersonalRecordDto) {
    return this.prService.create(req.user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my personal records' })
  findMine(@Request() req: any) {
    return this.prService.findMyRecords(req.user.id);
  }

  @Get('my/best')
  @ApiOperation({ summary: 'Get my best records for a specific exercise' })
  @ApiQuery({ name: 'exercise', required: true })
  findBest(@Request() req: any, @Query('exercise') exercise: string) {
    return this.prService.findBestByExercise(req.user.id, exercise);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all records (Admin)' })
  @ApiQuery({ name: 'exercise', required: false })
  findAll(@Query('exercise') exercise?: string) {
    return this.prService.findAllAdmin(exercise);
  }

  @Get('client/:clientId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get records by client (Admin)' })
  findByClient(@Param('clientId') clientId: string) {
    return this.prService.findAllByClient(clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific record (Admin or owner)' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.prService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a personal record' })
  update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdatePersonalRecordDto) {
    return this.prService.update(id, req.user.id, req.user.role, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a personal record' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.prService.remove(id, req.user.id, req.user.role);
  }
}
