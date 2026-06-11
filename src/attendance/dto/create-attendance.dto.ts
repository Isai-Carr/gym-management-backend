import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @ApiProperty({ example: 'client-uuid' })
  @IsString()
  clientId: string;

  @ApiPropertyOptional({ example: 'activity-uuid' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiPropertyOptional({ example: '2026-06-08T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  checkIn?: string;
}
