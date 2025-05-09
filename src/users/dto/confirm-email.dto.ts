import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @IsEmail()
  @ApiProperty()
  email: string;
}
