import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';
import { WeightUnit } from '@prisma/client';

export const EXERCISE_OPTIONS = [
  'Back Squat',
  'Front Squat',
  'Deadlift',
  'Snatch',
  'Clean & Jerk',
  'Bench Press',
  'Otros',
] as const;

export class CreatePersonalRecordDto {
  @ApiProperty({ example: 'Back Squat' })
  @IsString()
  exercise: string;

  @ApiProperty({ example: 100.5 })
  @IsNumber()
  @Min(0)
  weight: number;

  @ApiPropertyOptional({ enum: WeightUnit, default: WeightUnit.KG })
  @IsOptional()
  @IsEnum(WeightUnit)
  unit?: WeightUnit;

  @ApiPropertyOptional({ example: '2026-06-08T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional({ example: 'Personal best after 6 months of training' })
  @IsOptional()
  @IsString()
  notes?: string;
}
