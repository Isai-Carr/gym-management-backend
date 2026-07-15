import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, Min, IsNumber, IsDateString, IsIn,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

// TRANSFER is intentionally excluded — this endpoint is JSON-only and can't
// take a voucher upload. Transfer renewals go through POST /payments/transfer.
const CHARGEABLE_METHODS = [PaymentMethod.CASH, PaymentMethod.TERMINAL] as const;

export class RenewMembershipDto {
  @ApiPropertyOptional({ example: 'plan-uuid', description: 'Cambiar de plan al renovar. Si no se envía, se usa el plan actual.' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Cantidad de meses a renovar. Precio sugerido = plan.price × months.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;

  @ApiPropertyOptional({ example: 100, default: 0, description: 'Ajuste manual: positivo = descuento (se resta), negativo = incremento (se suma).' })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({ example: '2026-07-15', description: 'Fecha de inicio de la renovación. Default: hoy o el vencimiento actual, lo que sea más tarde.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    enum: CHARGEABLE_METHODS,
    example: PaymentMethod.CASH,
    description: 'Si se envía, se registra un Payment atómicamente junto con la renovación. Si se omite, la membresía se extiende sin cobro (renovación de cortesía).',
  })
  @IsOptional()
  @IsIn(CHARGEABLE_METHODS)
  paymentMethod?: typeof CHARGEABLE_METHODS[number];

  @ApiPropertyOptional({ example: 'TXN-001' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: 'Renovación en recepción' })
  @IsOptional()
  @IsString()
  notes?: string;
}
