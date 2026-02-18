import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/entities/user.entity';

export type VerificationDocument = Verification & Document;

// 1. Define enum for status
export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Verification {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  email: string;

  @Prop({ default: null })
  phone?: string;

  @Prop({ default: null })
  nin?: string;

  @Prop({ required: true })
  landlordDisplayName: string;

  // 2. Use enum for status with default value
  @Prop({
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy: User;

  // 3. Track custom dates
  @Prop({ default: () => new Date() })
  dateRequested: Date;

  @Prop({ default: () => new Date() })
  dateUpdated: Date;
}

export const VerificationSchema = SchemaFactory.createForClass(Verification);

// Optional: Add middleware to auto-update `dateUpdated` on save
VerificationSchema.pre('save', function (next) {
  this.dateUpdated = new Date();
  next();
});
