import { PartialType } from '@nestjs/swagger';
import { CreatePersonalRecordDto } from './create-personal-record.dto';

export class UpdatePersonalRecordDto extends PartialType(CreatePersonalRecordDto) {}
