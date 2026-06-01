import {
  IsDateString,
  IsInt,
  IsString,
  IsOptional,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  capacity!: number;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;
}