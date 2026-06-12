import {
  BadRequestException, Body, Controller, Delete, Get, Param,
  Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { Role, InventoryType, InventoryStatus } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

const imageStorage = diskStorage({
  destination: join(process.cwd(), 'storage', 'inventory'),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Add inventory item (Admin)' })
  create(@Body() dto: CreateInventoryDto) {
    return this.inventoryService.create(dto);
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image', {
    storage: imageStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!/jpg|jpeg|png|webp/.test(extname(file.originalname).toLowerCase())) {
        return cb(new Error('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload inventory item image (Admin)' })
  uploadImage(
    @Body('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    const imageUrl = `/storage/inventory/${file.filename}`;
    return this.inventoryService.updateImage(itemId, imageUrl);
  }

  @Patch('update-image/:id')
  @UseInterceptors(FileInterceptor('image', { storage: imageStorage }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update inventory item image (Admin)' })
  updateImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file is required');
    const imageUrl = `/storage/inventory/${file.filename}`;
    return this.inventoryService.updateImage(id, imageUrl);
  }

  @Delete('delete-image/:id')
  @ApiOperation({ summary: 'Remove inventory item image (Admin)' })
  deleteImage(@Param('id') id: string) {
    return this.inventoryService.updateImage(id, null);
  }

  @Get()
  @ApiOperation({ summary: 'Get all inventory items (Admin)' })
  @ApiQuery({ name: 'type', enum: InventoryType, required: false })
  @ApiQuery({ name: 'status', enum: InventoryStatus, required: false })
  findAll(
    @Query('type') type?: InventoryType,
    @Query('status') status?: InventoryStatus,
  ) {
    return this.inventoryService.findAll(type, status);
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Get items in maintenance (Admin)' })
  getInMaintenance() {
    return this.inventoryService.getInMaintenance();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID (Admin)' })
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inventory item (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete inventory item (Admin)' })
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
