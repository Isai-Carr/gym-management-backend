import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail, IsEnum, IsNumber, IsOptional,
  IsPositive, IsString, IsDateString,
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
  @ApiProperty({ example: 1200, description: 'Monto pagado' })
  @IsNumber()
  @IsPositive()
  amount: number;

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
