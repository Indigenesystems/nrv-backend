import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @IsString()
  @ApiProperty()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @ApiProperty()
  newPassword: string;
}
