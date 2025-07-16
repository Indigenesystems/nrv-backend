import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class VerificationHistory {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  type: string; // e.g., 'nin', 'bvn', etc.

  @Prop({ type: Object, required: true })
  input: Record<string, any>;

  @Prop({ type: Object, required: true })
  result: Record<string, any>;

  @Prop({ required: true })
  adminId: string;

  @Prop({ required: true })
  adminName: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export type VerificationHistoryDocument = VerificationHistory & Document;
export const VerificationHistorySchema = SchemaFactory.createForClass(VerificationHistory); 