import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateDirectPaymentDto {
  @ApiProperty({ example: 'membership-uuid' })
  @IsString()
  membershipId: string;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'TXN-123' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: 'Pago en recepción' })
  @IsOptional()
  @IsString()
  notes?: string;
}
