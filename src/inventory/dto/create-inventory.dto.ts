import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsBoolean, IsDateString, Min } from 'class-validator';
import { InventoryType, InventoryStatus } from '@prisma/client';

export class CreateInventoryDto {
  @ApiProperty({ example: 'Barra Olímpica' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Barras' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Barra olímpica de 20kg' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: InventoryType, example: InventoryType.EQUIPMENT })
  @IsEnum(InventoryType)
  type: InventoryType;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ enum: InventoryStatus, default: InventoryStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  maintenanceRequired?: boolean;

  @ApiPropertyOptional({ example: 'Requiere revisión anual' })
  @IsOptional()
  @IsString()
  notes?: string;
}
