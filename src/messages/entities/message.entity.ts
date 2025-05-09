import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity'; // Assuming you have a User entity
import { Conversation } from './conversation.entity';
import { required } from 'joi';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  @ApiProperty()
  sender: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  @ApiProperty()
  recipient: string;

  @Prop({ required: true })
  @ApiProperty()
  content: string;

  @Prop()
  @ApiProperty()
  files: string[];
}

export type MessageDocument = Message & Document;

export const MessageSchema = SchemaFactory.createForClass(Message);
