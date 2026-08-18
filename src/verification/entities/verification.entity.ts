import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/entities/user.entity';

export type VerificationDocument = Verification & Document;

// 1. Define enum for status
export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DECLINED = 'declined',
}

@Schema({ timestamps: true })
export class Verification {
  /** Short unique reference number (5 digits) for display and lookup. Set on creation. */
  @Prop({ unique: true, sparse: true })
  uniqueId?: number;

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

  /** Preferred screening tier when landlord runs Dojah screening: standard or premium. */
  @Prop({ type: String, enum: ['standard', 'premium'], default: 'standard' })
  verificationTier?: 'standard' | 'premium';

  /** Catalog credit cost (Naira) consumed for this request. */
  @Prop({ default: null })
  creditCostNaira?: number;

  /** Application that triggered this verification (optional). */
  @Prop({ type: Types.ObjectId, ref: 'Application', default: null })
  applicationId?: Types.ObjectId;

  /** Unit / room linked to the request (optional). */
  @Prop({ type: Types.ObjectId, ref: 'Room', default: null })
  roomId?: Types.ObjectId;

  /** Property listing linked to the request (optional). */
  @Prop({ type: Types.ObjectId, ref: 'Property', default: null })
  propertyId?: Types.ObjectId;

  /** Denormalized label for unit/property (e.g. "Unit #3 · Lekki Phase 1"). */
  @Prop({ default: null })
  propertyLabel?: string;

  // 3. Track custom dates
  @Prop({ default: () => new Date() })
  dateRequested: Date;

  @Prop({ default: () => new Date() })
  dateUpdated: Date;

  /** When the landlord's consumed credit was refunded (decline/reject). */
  @Prop({ default: null })
  creditRefundedAt?: Date;
}

export const VerificationSchema = SchemaFactory.createForClass(Verification);

// Optional: Add middleware to auto-update `dateUpdated` on save
VerificationSchema.pre('save', function (next) {
  this.dateUpdated = new Date();
  next();
});
