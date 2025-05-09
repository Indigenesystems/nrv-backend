import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Schema()
export class NotificationSettings {
  @Prop({ type: Types.ObjectId, ref: 'User', validate: /^[0-9a-fA-F]{24}$/ })
  @ApiProperty()
  userId: User;

  @Prop()
  @ApiProperty()
  platformUpdates: boolean;

  @Prop()
  @ApiProperty()
  promotions: boolean;

  @Prop()
  @ApiProperty()
  weeklyOpportunities: boolean;

  @Prop()
  @ApiProperty()
  feedbackOpportunities: boolean;

  @Prop()
  @ApiProperty()
  maintenanceUpdates: boolean;

  @Prop()
  @ApiProperty()
  messagePreference: string;
}

export type NotificationSettingsDocument = NotificationSettings & Document;

export const NotificationSettingsSchema =
  SchemaFactory.createForClass(NotificationSettings);
