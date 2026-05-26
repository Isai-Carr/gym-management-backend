import {
  IsDateString,
  IsString,
} from 'class-validator';

export class CreateMembershipDto {
  @IsString()
  clientId!: string;

  @IsString()
  planId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}