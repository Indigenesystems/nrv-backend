import { IsString, IsEmail, IsNotEmpty, IsNumberString, Length } from 'class-validator';

export class ConfirmUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  confirmationCode: string;
}


