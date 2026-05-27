import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async uploadAvatar(
    userId: string,
    filename: string,
  ) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        avatar: filename,
      },
    });
  }
}