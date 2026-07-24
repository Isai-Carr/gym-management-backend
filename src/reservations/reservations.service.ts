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
    // Wrap in transaction so membership check + capacity check + insert are atomic
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: dto.clientId },
        include: {
          memberships: {
            where: { isActive: true, status: 'ACTIVE', endDate: { gte: new Date() } },
            take: 1,
          },
        },
      });

      if (!client) {
        throw new NotFoundException('Client not found');
      }

      if (client.memberships.length === 0) {
        throw new BadRequestException('Client does not have an active membership');
      }

      // Lock the class row first so concurrent reservation attempts for the same
      // class serialize here — without this, two requests can both read
      // count < capacity before either commits, causing overbooking.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Class" WHERE id = ${dto.classId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException('Class not found');
      }

      const gymClass = await tx.class.findUnique({
        where: { id: dto.classId },
        include: { reservations: { select: { id: true } } },
      });

      if (!gymClass) {
        throw new NotFoundException('Class not found');
      }

      if (gymClass.reservations.length >= gymClass.capacity) {
        throw new BadRequestException('Class is full');
      }

      try {
        return await tx.reservation.create({
          data: dto,
          include: { client: true, class: true },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          throw new BadRequestException('You already have a reservation for this class');
        }
        throw err;
      }
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
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { class: { select: { startTime: true } } },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.class.startTime <= new Date()) {
      throw new BadRequestException('Cannot cancel a reservation for a class that already started');
    }
    return this.prisma.reservation.delete({ where: { id } });
  }
}
