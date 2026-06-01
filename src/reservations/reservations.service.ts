import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateClassDto } from './dto/create-class.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async createClass(
    dto: CreateClassDto,
  ) {
    return this.prisma.class.create({
      data: {
        ...dto,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
    });
  }

  async getClasses() {
    return this.prisma.class.findMany({
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  async createReservation(
    dto: CreateReservationDto,
  ) {
    const gymClass =
      await this.prisma.class.findUnique({
        where: {
          id: dto.classId,
        },
        include: {
          reservations: true,
        },
      });

    if (!gymClass) {
      throw new NotFoundException(
        'Class not found',
      );
    }

    if (
      gymClass.reservations.length >=
      gymClass.capacity
    ) {
      throw new BadRequestException(
        'Class is full',
      );
    }

    return this.prisma.reservation.create({
      data: dto,
    });
  }

  async getReservations() {
    return this.prisma.reservation.findMany({
      include: {
        client: true,
        class: true,
      },
    });
  }

  async cancelReservation(
    id: string,
  ) {
    return this.prisma.reservation.delete({
      where: {
        id,
      },
    });
  }
}