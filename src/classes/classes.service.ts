import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClassDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }

    return this.prisma.class.create({
      data: {
        ...dto,
        startTime: start,
        endTime: end,
      },
    });
  }

  async findAll() {
    return this.prisma.class.findMany({
      include: {
        _count: { select: { reservations: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string) {
    const gymClass = await this.prisma.class.findUnique({
      where: { id },
      include: {
        reservations: { include: { client: true } },
        _count: { select: { reservations: true } },
      },
    });

    if (!gymClass) {
      throw new NotFoundException('Class not found');
    }

    return gymClass;
  }

  async update(id: string, dto: UpdateClassDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = { ...dto };

    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);

    return this.prisma.class.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.class.delete({ where: { id } });
  }

  async getSchedule() {
    return this.prisma.class.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { reservations: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }
}
