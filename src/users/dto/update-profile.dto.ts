import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'María' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'García' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+52 55 1234 5678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Av. Reforma 123, Col. Centro, Aguascalientes' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '1995-08-20' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'María Pérez - +52 55 9876 5432' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;
}
