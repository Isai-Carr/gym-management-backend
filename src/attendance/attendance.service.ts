import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(dto: CreateAttendanceDto) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      include: {
        user: true,
        memberships: {
          where: { isActive: true, status: 'ACTIVE', endDate: { gte: new Date() } },
          take: 1,
        },
      },
    });

    if (!client) throw new NotFoundException('Client not found');
    if (!client.user.isActive) throw new BadRequestException('Client account is disabled');
    if (client.memberships.length === 0) {
      throw new BadRequestException('Client does not have an active membership');
    }

    return this.prisma.attendance.create({
      data: {
        clientId: dto.clientId,
        activityId: dto.activityId ?? null,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : new Date(),
      },
      include: {
        client: true,
        activity: true,
      },
    });
  }

  async register(dto: CreateAttendanceDto) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.attendance.create({
      data: {
        clientId: dto.clientId,
        activityId: dto.activityId ?? null,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : new Date(),
      },
      include: { client: true, activity: true },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        include: { client: true, activity: true },
        orderBy: { checkIn: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendance.count(),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findByClient(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.attendance.findMany({
      where: { clientId },
      include: { client: true, activity: true },
      orderBy: { checkIn: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return this.prisma.attendance.findMany({
      where: { checkIn: { gte: startDate, lte: endDate } },
      include: { client: true, activity: true },
      orderBy: { checkIn: 'desc' },
    });
  }
}
