import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail, IsEnum, IsNumber, IsOptional,
  IsInt, Min, IsString, IsDateString,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RegisterClientFullDto {
  // ── Página 1: Información personal ─────────────────────────
  @ApiProperty({ example: 'Isai' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Camarena Carreon' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'isai@email.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '4495406895' })
  @IsOptional()
  @IsString()
  phone?: string;

  // ── Página 2: Membresía ─────────────────────────────────────
  @ApiProperty({ example: 'plan-uuid', description: 'ID del plan de membresía' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ example: 'activity-uuid', description: 'Actividad opcional' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiPropertyOptional({
    example: '2026-06-12',
    description: 'Fecha de inicio. Si no se envía, se usa la fecha de hoy.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  // ── Página 3: Pago ──────────────────────────────────────────
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Cantidad de meses a cobrar. El precio se calcula como plan.price × months.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;

  @ApiPropertyOptional({
    example: 100,
    default: 0,
    description: 'Ajuste manual sobre el precio calculado. Positivo = descuento (se resta), negativo = incremento (se suma).',
  })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'TXN-001', description: 'ID de transacción (transferencias)' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: 'Pago en efectivo en recepción' })
  @IsOptional()
  @IsString()
  notes?: string;
}
