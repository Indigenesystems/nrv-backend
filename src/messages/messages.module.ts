import { Module } from '@nestjs/common';
import { MessagingService } from './messages.service';
import { MessagingController } from './messages.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Message,
  MessageDocument,
  MessageSchema,
} from './entities/message.entity';
import {
  Conversation,
  ConversationSchema,
} from './entities/conversation.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { EmailService } from 'src/email-sender/email.service';
import { ApiProperty } from '@nestjs/swagger';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, CloudinaryService, EmailService],
})
export class MessagesModule {}
