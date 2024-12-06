import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity'; // Assuming you have a User entity
import { Conversation } from './conversation.entity';

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation' })
  conversationId: Conversation;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  senderId: User;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  recipientId: User;

  @Prop()
  content: string; // The text content of the message

  @Prop({ default: false })
  isRead: boolean; // Whether the message has been read by the recipient

  @Prop({ default: null })
  readAt: Date; // Timestamp of when the message was read, if applicable

  @Prop({ default: false })
  isDeleted: boolean; // Marks if the message is deleted by sender or receiver

  @Prop({ default: null })
  deletedAt: Date; // Timestamp of when the message was deleted, if applicable
}

export type MessageDocument = Message & Document;

export const MessageSchema = SchemaFactory.createForClass(Message);
