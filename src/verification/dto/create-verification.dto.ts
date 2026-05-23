import { IsDateString, IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, Matches } from 'class-validator';

export class CreateVerificationDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsPhoneNumber('NG')
  phone?: string;

  @IsOptional()
  @IsString()
  nin?: string;

  @IsString()
  @IsNotEmpty()
  landlordDisplayName: string;

  @IsString()
  @IsNotEmpty()
  requestedBy: string;

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'premium'])
  verificationTier?: 'standard' | 'premium';
}




export class CreateTenantVerificationDto {
  @IsNotEmpty() @IsString() fullName: string;
  @IsNotEmpty() @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() nin?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'BVN must be exactly 11 digits' })
  bvn?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() gender?: string;
  @IsNotEmpty() @IsString() verificationId: string;
  @IsOptional() @IsString() createdBy?: string;
}

export class UpdatePersonalDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'BVN must be exactly 11 digits' })
  bvn?: string;
}



export class UpdateEmploymentDto {
  @IsOptional() @IsString() employmentStatus?: string;
  @IsOptional() @IsString() roleInCompany?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() currentEmployer?: string;
  @IsOptional() @IsString() companyAddress?: string;
  @IsOptional() @IsNumber() monthlyIncome?: number;
  @IsOptional() @IsDateString() dateJoined?: string;
}



export class UpdateGuarantorDto {
  @IsOptional() @IsString() guarantorFirstName?: string;
  @IsOptional() @IsString() guarantorLastName?: string;
  @IsOptional() @IsEmail() guarantorEmail?: string;
  @IsOptional() @IsString() guarantorPhone?: string;
  @IsOptional() @IsString() guarantorEmploymentStatus?: string;
  @IsOptional() @IsString() guarantorCompany?: string;
  @IsOptional() @IsString() guarantorAddress?: string;
}

// Generic response pattern for verification actions
export const verificationSuccessResponse = (message: string, data: any) => {
  return {
    status: 'success',
    message,
    data,
  };
};
