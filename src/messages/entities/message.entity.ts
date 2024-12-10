import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity'; // Assuming you have a User entity
import { Conversation } from './conversation.entity';
import { required } from 'joi';

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient: string;

  @Prop({ required: true })
  content: string;
  
  @Prop()
  files: string[];
}

export type MessageDocument = Message & Document;

export const MessageSchema = SchemaFactory.createForClass(Message);
