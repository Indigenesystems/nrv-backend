import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StaffDocument = Staff & Document;

export enum OnboardingStatus {
  PENDING = 'pending',
  INVITED = 'invited',
  ONBOARDED = 'onboarded',
  DEACTIVATED = 'deactivated',
}

@Schema({ timestamps: true })
export class Staff {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  phone?: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true })
  roleId: Types.ObjectId;

  @Prop({
    type: String,
    enum: OnboardingStatus,
    default: OnboardingStatus.PENDING,
  })
  onboardingStatus: OnboardingStatus;

  @Prop()
  password?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Staff', default: null })
  invitedBy?: Types.ObjectId;

  @Prop({ default: null })
  invitedAt?: Date;

  @Prop({ default: null })
  onboardedAt?: Date;

  @Prop({ default: null })
  lastLoginAt?: Date;
}

export const StaffSchema = SchemaFactory.createForClass(Staff);
