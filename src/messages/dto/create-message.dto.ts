import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Sender name must not exceed 50 characters' })
  @ApiProperty()
  sender: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Recipient name must not exceed 50 characters' })
  @ApiProperty()
  recipient: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: 'Content must not exceed 500 characters' })
  @ApiProperty()
  content: string;
}
