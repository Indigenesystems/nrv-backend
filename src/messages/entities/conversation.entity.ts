import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity'; // Assuming you have a User entity

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: [Types.ObjectId], ref: 'User' })
  participants: User[]; // List of participants in the conversation (could be 2 for a private message)

  @Prop({ default: 'group' })
  conversationType: string; // Type can be 'group' or 'private'

  @Prop()
  title: string; // Title of the conversation, optional for private messages

  @Prop({ default: false })
  isDeleted: boolean; // Marks if the conversation is deleted

  @Prop({ default: null })
  deletedAt: Date; // Timestamp of when the conversation was deleted, if applicable
}

export type ConversationDocument = Conversation & Document;

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
