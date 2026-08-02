import { IsDateString, IsEmail, IsIn, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, Matches } from 'class-validator';

export class CreateVerificationDto {
  @IsString({ message: 'First name is required' })
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString({ message: 'Last name is required' })
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsOptional()
  @IsPhoneNumber('NG', { message: 'Enter a valid Nigerian phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  nin?: string;

  @IsString({ message: 'Landlord display name is required' })
  @IsNotEmpty({ message: 'Landlord display name is required' })
  landlordDisplayName: string;

  @IsString({ message: 'Landlord account is required' })
  @IsNotEmpty({ message: 'Landlord account is required' })
  requestedBy: string;

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'premium'], {
    message: 'Verification tier must be standard or premium',
  })
  verificationTier?: 'standard' | 'premium';

  @IsOptional()
  @IsMongoId({ message: 'Invalid application id' })
  applicationId?: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid room id' })
  roomId?: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid property id' })
  propertyId?: string;

  @IsOptional()
  @IsString()
  propertyLabel?: string;
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
