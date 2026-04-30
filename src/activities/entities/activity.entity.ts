import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Activity {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  details: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Object, required: false })
  metadata?: Record<string, unknown>;
}

export type ActivityDocument = Activity & Document;
export const ActivitySchema = SchemaFactory.createForClass(Activity);
