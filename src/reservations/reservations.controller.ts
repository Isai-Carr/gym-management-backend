import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a class reservation' })
  createReservation(@Body() dto: CreateReservationDto, @Request() req: any) {
    if (req.user.role !== 'ADMIN') {
      dto.clientId = req.user.client?.id;
    }
    return this.reservationsService.createReservation(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all reservations (Admin)' })
  getReservations() {
    return this.reservationsService.getReservations();
  }

  @Get('client/:id')
  @ApiOperation({ summary: 'Get reservations by client (Admin or own)' })
  getReservationsByClient(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== Role.ADMIN && req.user.client?.id !== id) {
      throw new ForbiddenException('Access denied');
    }
    return this.reservationsService.getReservationsByClient(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a reservation (Admin or owner)' })
  async cancelReservation(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== Role.ADMIN) {
      await this.reservationsService.assertOwnership(id, req.user.client?.id);
    }
    return this.reservationsService.cancelReservation(id);
  }
}
