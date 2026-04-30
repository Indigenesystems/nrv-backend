import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, MinLength } from 'class-validator';
import { OnboardingStatus } from '../entities/staff.entity';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsEnum(OnboardingStatus)
  @IsOptional()
  onboardingStatus?: OnboardingStatus;
}
