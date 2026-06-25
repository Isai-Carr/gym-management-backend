import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCardPaymentDto {
  @ApiProperty({ description: 'ID de la membresía a pagar' })
  @IsString()
  membershipId!: string;

  @ApiProperty({ description: 'Monto a cobrar (debe coincidir con el plan)' })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ description: 'Token de tarjeta generado por el SDK de MercadoPago en el frontend' })
  @IsString()
  cardToken!: string;

  @ApiProperty({ description: 'ID del método de pago (visa, master, amex, etc.) — devuelto por MP JS SDK' })
  @IsString()
  paymentMethodId!: string;

  @ApiPropertyOptional({ description: 'ID del banco emisor — devuelto por MP JS SDK' })
  @IsOptional()
  @IsString()
  issuerId?: string;

  @ApiPropertyOptional({ description: 'Número de mensualidades (1 = pago único)', default: 1 })
  @IsInt()
  @Min(1)
  @Max(24)
  installments: number = 1;

  @ApiProperty({ description: 'Email del titular de la tarjeta' })
  @IsEmail()
  payerEmail!: string;
}
