import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonalRecordDto } from './dto/create-personal-record.dto';
import { UpdatePersonalRecordDto } from './dto/update-personal-record.dto';
import { Role } from '@prisma/client';

@Injectable()
export class PersonalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getClientId(userId: string): Promise<string> {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');
    return client.id;
  }

  async create(userId: string, dto: CreatePersonalRecordDto) {
    const clientId = await this.getClientId(userId);

    return this.prisma.personalRecord.create({
      data: {
        clientId,
        exercise: dto.exercise,
        weight: dto.weight,
        unit: dto.unit,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        notes: dto.notes,
      },
      include: { client: true },
    });
  }

  async findAllByClient(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.personalRecord.findMany({
      where: { clientId },
      orderBy: [{ exercise: 'asc' }, { recordedAt: 'desc' }],
    });
  }

  async findMyRecords(userId: string) {
    const clientId = await this.getClientId(userId);
    return this.findAllByClient(clientId);
  }

  async findBestByExercise(userId: string, exercise: string) {
    const clientId = await this.getClientId(userId);

    return this.prisma.personalRecord.findMany({
      where: { clientId, exercise },
      orderBy: { weight: 'desc' },
      take: 5,
    });
  }

  async findOne(id: string, userId?: string, role?: Role) {
    const record = await this.prisma.personalRecord.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!record) throw new NotFoundException('Personal record not found');

    if (userId && role !== Role.ADMIN) {
      const clientId = await this.getClientId(userId);
      if (record.clientId !== clientId) throw new ForbiddenException('Not your record');
    }

    return record;
  }

  async update(id: string, userId: string, role: Role, dto: UpdatePersonalRecordDto) {
    const record = await this.findOne(id);

    if (role !== Role.ADMIN) {
      const clientId = await this.getClientId(userId);
      if (record.clientId !== clientId) throw new ForbiddenException('Not your record');
    }

    return this.prisma.personalRecord.update({
      where: { id },
      data: {
        ...dto,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
      },
    });
  }

  async remove(id: string, userId: string, role: Role) {
    const record = await this.findOne(id);

    if (role !== Role.ADMIN) {
      const clientId = await this.getClientId(userId);
      if (record.clientId !== clientId) throw new ForbiddenException('Not your record');
    }

    return this.prisma.personalRecord.delete({ where: { id } });
  }

  async findAllAdmin(exercise?: string) {
    return this.prisma.personalRecord.findMany({
      where: exercise ? { exercise } : undefined,
      include: { client: true },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
