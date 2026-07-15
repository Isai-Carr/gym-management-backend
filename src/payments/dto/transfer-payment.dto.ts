import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsOptional, IsPositive, IsInt, Min,
} from 'class-validator';

export class TransferPaymentDto {
  @ApiProperty({ example: 'membership-uuid' })
  @IsString()
  membershipId: string;

  @ApiPropertyOptional({
    example: 1200,
    description: 'Monto a transferir. Requerido si no se envía `months` (en cuyo caso se calcula a partir del plan).',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Cantidad de meses que cubre este pago (renovación). Si se envía, el monto se calcula como plan.price × months, ajustado por `discount`, y al aprobar el pago la membresía se extiende automáticamente.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Ajuste manual sobre el precio calculado por meses. Positivo = descuento (se resta), negativo = incremento (se suma). Solo aplica si se envía `months`.',
  })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({ example: 'Nota del pago' })
  @IsOptional()
  @IsString()
  notes?: string;
}
