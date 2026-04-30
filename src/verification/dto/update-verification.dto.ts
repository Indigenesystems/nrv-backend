import { IsEnum, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateVerificationDto } from './create-verification.dto';
import { VerificationStatus } from '../entities/verification.entity';

export class UpdateVerificationDto extends PartialType(CreateVerificationDto) {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}
