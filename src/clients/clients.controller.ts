import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateClientDto } from './dto/create-client.dto';
import { RegisterClientFullDto } from './dto/register-client-full.dto';
import { GetClientsDto } from './dto/get-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Full client registration: personal info + membership + payment in one step (Admin)',
  })
  registerFull(@Body() dto: RegisterClientFullDto) {
    return this.clientsService.registerFull(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create client only (no membership) and send welcome email (Admin)' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all clients with pagination and search (Admin)' })
  findAll(@Query() query: GetClientsDto) {
    return this.clientsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID (Admin)' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate client (soft delete) (Admin)' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Get client payment history (Admin)' })
  getPayments(@Param('id') id: string) {
    return this.clientsService.getClientPayments(id);
  }

  @Get(':id/attendance')
  @ApiOperation({ summary: 'Get client attendance history (Admin)' })
  getAttendance(@Param('id') id: string) {
    return this.clientsService.getClientAttendance(id);
  }
}
