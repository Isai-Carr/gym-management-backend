import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ChangeMembershipPlanDto {
  @ApiProperty({ example: 'plan-uuid' })
  @IsString()
  planId: string;
}
