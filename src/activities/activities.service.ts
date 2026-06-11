import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateActivityDto) {
    const existing = await this.prisma.activity.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Activity name already exists');

    return this.prisma.activity.create({ data: dto });
  }

  async findAll(onlyActive = false) {
    return this.prisma.activity.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async update(id: string, dto: UpdateActivityDto) {
    await this.findOne(id);
    return this.prisma.activity.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.activity.delete({ where: { id } });
  }
}
