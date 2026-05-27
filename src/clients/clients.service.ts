import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { GetClientsDto } from './dto/get-clients.dto';
import { QueryClientDto } from './dto/query-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GetClientsDto) {
  const {
  page = 1,
  limit = 10,
  search,
  sortBy = 'createdAt',
  order = 'desc',
} = query;

  const skip =
    (page - 1) * limit;

  const where = search
    ? {
        OR: [
          {
            firstName: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          {
            lastName: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }
    : {};

  const clients =
    await this.prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
  [sortBy]: order,
},
    });

  const total =
    await this.prisma.client.count({
      where,
    });

  return {
    data: clients,

    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(
        total / limit,
      ),
    },
  };
}

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: {
        id,
      },

      include: {
        user: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(
    id: string,
    dto: UpdateClientDto,
  ) {
    await this.findOne(id);

    return this.prisma.client.update({
      where: {
        id,
      },

      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.client.delete({
      where: {
        id,
      },
    });
  }
}