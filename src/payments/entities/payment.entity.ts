import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'success' | 'failed';

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Plan' })
  planId: Types.ObjectId;

  /** Payment type: e.g. 'pack' (verification credits pack). */
  @Prop({ required: true, default: 'pack' })
  type: string;

  /** Unique reference used with Paystack (e.g. pack_1739...). */
  @Prop({ required: true, unique: true })
  reference: string;

  /** Amount in Naira (display). */
  @Prop({ required: true })
  amountNaira: number;

  /** Number of packs purchased (default 1). */
  @Prop({ default: 1 })
  quantity: number;

  /** Amount in kobo (Paystack). */
  @Prop()
  amountKobo: number;

  @Prop({ default: 'NGN' })
  currency: string;

  @Prop({ required: true, enum: ['pending', 'success', 'failed'], default: 'pending' })
  status: PaymentStatus;

  /** When Paystack confirmed the payment (set on success). */
  @Prop()
  paidAt: Date;

  /** Plan name at time of purchase (for history display). */
  @Prop()
  planName: string;
}

export type PaymentDocument = Payment & Document;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
