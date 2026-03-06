import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VerificationTier = 'standard' | 'premium';

/**
 * Verification features per tier (Dojah-backed).
 * Standard: NIN Lookup Advanced, Selfie + NIN, Liveness, AML, Fraud risk, PEP & sanctions.
 * Premium: All Standard + Credit Score.
 */
@Schema({ timestamps: true, _id: true })
export class Plan {
  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  /** Verification tier: standard (platform launch) or premium (high-trust). */
  @Prop({ required: true, enum: ['standard', 'premium'] })
  verificationTier: VerificationTier;

  /** Max number of tenant verifications allowed per plan (legacy / display). */
  @Prop({ required: true, default: 5 })
  verificationLimit: number;

  /** One-time purchase: standard verification credits added when this pack is bought. */
  @Prop({ required: true, default: 5 })
  standardVerificationAdded: number;

  /** One-time purchase: premium verification credits added when this pack is bought. */
  @Prop({ required: true, default: 5 })
  premiumVerificationAdded: number;

  /** Human-readable list of verification features (for display). */
  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export type PlanDocument = Plan & Document;
export const PlanSchema = SchemaFactory.createForClass(Plan);
