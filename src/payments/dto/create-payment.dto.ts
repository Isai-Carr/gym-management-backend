import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsPositive } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ example: 'membership-uuid' })
  @IsString()
  membershipId: string;

  @ApiPropertyOptional({ example: 'client-uuid' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'TXN123456' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: 'Nota adicional' })
  @IsOptional()
  @IsString()
  notes?: string;
}
