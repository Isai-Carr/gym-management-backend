import {
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class QueryClientDto {
  @IsOptional()
  @IsNumberString()
  page?: string = '1';

  @IsOptional()
  @IsNumberString()
  limit?: string = '10';

  @IsOptional()
  @IsString()
  search?: string;
}