import {
  IsString,
} from 'class-validator';

export class CreateReservationDto {
  @IsString()
  clientId!: string;

  @IsString()
  classId!: string;
}