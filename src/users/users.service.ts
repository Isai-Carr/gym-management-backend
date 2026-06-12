import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true, email: true, role: true, isActive: true,
          avatar: true, mustChangePassword: true, createdAt: true,
          client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, isActive: true,
        avatar: true, mustChangePassword: true, createdAt: true,
        client: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: { isActive?: boolean; role?: Role }) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, isActive: true, updatedAt: true },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const { birthDate, ...rest } = dto;

    return this.prisma.client.update({
      where: { userId },
      data: {
        ...rest,
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
      },
      select: {
        id: true, firstName: true, lastName: true,
        phone: true, address: true, birthDate: true,
        avatarUrl: true, updatedAt: true,
      },
    });
  }

  async uploadAvatar(userId: string, filename: string) {
    const avatarUrl = `/storage/profiles/${filename}`;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: { id: true, email: true, avatar: true },
    });

    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (client) {
      await this.prisma.client.update({ where: { userId }, data: { avatarUrl } });
    }

    return user;
  }

  async deleteAvatar(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: { id: true, email: true },
    });
  }
}
