import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReservation(dto: CreateReservationDto) {
    const gymClass = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      include: { reservations: true },
    });

    if (!gymClass) {
      throw new NotFoundException('Class not found');
    }

    if (gymClass.reservations.length >= gymClass.capacity) {
      throw new BadRequestException('Class is full');
    }

    return this.prisma.reservation.create({
      data: dto,
      include: { client: true, class: true },
    });
  }

  async getReservations() {
    return this.prisma.reservation.findMany({
      include: { client: true, class: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReservationsByClient(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return this.prisma.reservation.findMany({
      where: { clientId },
      include: { class: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assertOwnership(reservationId: string, clientId?: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.clientId !== clientId) throw new ForbiddenException('Access denied');
  }

  async cancelReservation(id: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return this.prisma.reservation.delete({ where: { id } });
  }
}
