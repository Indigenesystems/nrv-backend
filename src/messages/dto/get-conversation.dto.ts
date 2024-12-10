import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GetConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Sender name must not exceed 50 characters' })
  sender: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Recipient name must not exceed 50 characters' })
  recipient: string;
}
