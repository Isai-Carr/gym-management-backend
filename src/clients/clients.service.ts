import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { GetClientsDto } from './dto/get-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private generateTemporaryPassword(): string {
    return String(Math.floor(1000000 + Math.random() * 9000000));
  }

  async create(dto: CreateClientDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new BadRequestException('Email already in use');

    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: Role.CLIENT,
        mustChangePassword: true,
        client: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
          },
        },
      },
      include: { client: true },
    });

    const loginUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/login`;
    await this.emailService.sendWelcome(
      dto.email,
      `${dto.firstName} ${dto.lastName}`,
      temporaryPassword,
      loginUrl,
    );

    const { password: _pwd, ...safeUser } = user;
    return { message: 'Client created successfully', user: safeUser };
  }

  private readonly ALLOWED_SORT_FIELDS = new Set(['createdAt', 'firstName', 'lastName', 'updatedAt']);

  async findAll(query: GetClientsDto) {
    const { page = 1, limit = 10, search, order = 'desc' } = query;
    const sortBy = this.ALLOWED_SORT_FIELDS.has(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { user: { select: { email: true, role: true, isActive: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, role: true, isActive: true, createdAt: true } },
        memberships: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const client = await this.findOne(id);
    await this.prisma.user.update({
      where: { id: client.userId },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { message: 'Client deactivated successfully' };
  }

  async getClientPayments(clientId: string) {
    await this.findOne(clientId);
    return this.prisma.payment.findMany({
      where: { membership: { clientId } },
      include: { membership: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClientAttendance(clientId: string) {
    await this.findOne(clientId);
    return this.prisma.attendance.findMany({
      where: { clientId },
      include: { activity: true },
      orderBy: { checkIn: 'desc' },
    });
  }
}
