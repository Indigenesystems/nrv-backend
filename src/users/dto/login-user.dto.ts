import { IsString, IsEmail, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';


export class LoginUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  /** When true, issue a long-lived httpOnly remember-me cookie. */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
