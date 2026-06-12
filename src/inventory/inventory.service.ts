import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, InventoryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInventoryDto) {
    return this.prisma.inventory.create({
      data: {
        ...dto,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      },
    });
  }

  async findAll(type?: InventoryType, status?: InventoryStatus) {
    return this.prisma.inventory.findMany({
      where: {
        ...(type && { type }),
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.inventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async update(id: string, dto: UpdateInventoryDto) {
    await this.findOne(id);
    return this.prisma.inventory.update({
      where: { id },
      data: {
        ...dto,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.inventory.delete({ where: { id } });
  }

  async getInMaintenance() {
    return this.prisma.inventory.findMany({
      where: { status: InventoryStatus.IN_MAINTENANCE },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateImage(id: string, imageUrl: string | null) {
    await this.findOne(id);
    return this.prisma.inventory.update({ where: { id }, data: { imageUrl } });
  }
}
