import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RunStandardScreeningDto {
  @IsOptional()
  @IsString()
  requestedBy?: string;

  @IsString()
  @IsNotEmpty()
  nin: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  dateOfBirth: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  selfieImageBase64?: string;

  @IsOptional()
  @IsString()
  livenessImageBase64?: string;
}

export class RunPremiumScreeningDto extends RunStandardScreeningDto {
  @IsOptional()
  @IsString()
  bvn?: string;
}
