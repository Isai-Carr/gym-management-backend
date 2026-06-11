import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateMembershipDto {
  @ApiProperty({ example: 'client-uuid' })
  @IsString()
  clientId: string;

  @ApiProperty({ example: 'plan-uuid' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ example: 'activity-uuid' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiProperty({ example: '2026-06-08T00:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-07-08T00:00:00Z' })
  @IsDateString()
  endDate: string;
}
