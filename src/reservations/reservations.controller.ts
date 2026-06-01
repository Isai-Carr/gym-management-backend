import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

import { ReservationsService } from './reservations.service';

import { CreateClassDto } from './dto/create-class.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Controller('reservations')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
  ) {}

  @Post('classes')
  @Roles(Role.ADMIN)
  createClass(
    @Body() dto: CreateClassDto,
  ) {
    return this.reservationsService.createClass(
      dto,
    );
  }

  @Get('classes')
  getClasses() {
    return this.reservationsService.getClasses();
  }

  @Post()
  createReservation(
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.createReservation(
      dto,
    );
  }

  @Get()
  getReservations() {
    return this.reservationsService.getReservations();
  }

  @Delete(':id')
  cancelReservation(
    @Param('id') id: string,
  ) {
    return this.reservationsService.cancelReservation(
      id,
    );
  }
}