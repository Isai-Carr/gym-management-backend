import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@oasisgym.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Carlos' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'López' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: '4491234567' })
  @IsOptional()
  @IsString()
  phone?: string;
}
