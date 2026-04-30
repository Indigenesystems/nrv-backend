import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffDto } from './create-staff.dto';
import { IsOptional, IsEnum, MinLength } from 'class-validator';
import { OnboardingStatus } from '../entities/staff.entity';

export class UpdateStaffDto extends PartialType(CreateStaffDto) {
  @IsOptional()
  @IsEnum(OnboardingStatus)
  onboardingStatus?: OnboardingStatus;

  @IsOptional()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsOptional()
  status?: string;
}
