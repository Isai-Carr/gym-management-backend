import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class TransferPaymentDto {
  @ApiProperty({ example: 'membership-uuid' })
  @IsString()
  membershipId: string;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'Nota del pago' })
  @IsOptional()
  @IsString()
  notes?: string;
}
