import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMembershipPlanDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price!: number;

  @IsNumber()
  duration!: number;
}