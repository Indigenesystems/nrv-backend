import { IsString, IsEmail, IsNotEmpty, IsNumberString, Length, IsEnum } from 'class-validator';

// Define enum for account type
export enum AccountType {
  LANDLORD = 'landlord',
  TENANT = 'tenant',
}

export class CreateUserDto {
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
  @IsNotEmpty()
  nin: string;

  @IsNumberString()
  @IsNotEmpty()
  @Length(11)
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  homeAddress: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmationCode: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsEnum(AccountType) 
  @IsNotEmpty()
  accountType: AccountType; 
}
