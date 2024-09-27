import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';

@Schema()
export class NotificationSettings {

  @Prop({ type: Types.ObjectId, ref: 'User', validate: /^[0-9a-fA-F]{24}$/ })
  userId: User;

  @Prop()
  platformUpdates: boolean;

  @Prop()
  promotions: boolean;

  @Prop()
  weeklyOpportunities: boolean;

  @Prop()
  feedbackOpportunities: boolean;

  @Prop()
  maintenanceUpdates: boolean;

  @Prop()
  messagePreference: string;
}

export type NotificationSettingsDocument = NotificationSettings & Document;

export const NotificationSettingsSchema = SchemaFactory.createForClass(NotificationSettings);


