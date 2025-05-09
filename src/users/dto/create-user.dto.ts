import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  Length,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Define enum for account type
export enum AccountType {
  LANDLORD = 'landlord',
  TENANT = 'tenant',
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  nin: string;

  @IsNumberString()
  @IsNotEmpty()
  @Length(11)
  @ApiProperty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  homeAddress: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  confirmationCode: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  status: string;

  @IsBoolean()
  @IsNotEmpty()
  @ApiProperty()
  isOnboarded: boolean;

  @IsEnum(AccountType)
  @IsNotEmpty()
  @ApiProperty()
  accountType: AccountType;
}
