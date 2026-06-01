import {
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  create(
    dto: CreateNotificationDto,
  ) {
    return this.prisma.notification.create({
      data: dto,
    });
  }

  findAll() {
    return this.prisma.notification.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },

      data: {
        isRead: true,
      },
    });
  }
}