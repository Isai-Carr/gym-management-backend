import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({ example: 'CrossFit' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'High-intensity functional fitness training' })
  @IsOptional()
  @IsString()
  description?: string;
}
