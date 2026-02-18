import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
//import { Document } from 'mongoose';


@Schema({ timestamps: true })
export class VerificationResponse {
  @Prop()
  verificationId: string;

  @Prop()
  fullName: string;

  @Prop({unique: false})
  email: string;

  @Prop({ default: null })
  phone?: string;

  @Prop({ default: null })
  nin?: string;

  @Prop()
  dateOfBirth: Date;

  @Prop({ default: null })
  address?: string;

  @Prop({ default: null })
  employmentStatus?: string;

  @Prop({ default: null })
  roleInCompany?: string;

  @Prop({ default: null })
  companyName?: string;

  @Prop({ default: null })
  companyAddress?: string;

  @Prop({ default: null })
  monthlyIncome?: number;

  @Prop({ default: null })
  dateJoined?: string;

  @Prop({ default: null })
  guarantorFirstName?: string;

  @Prop({ default: null })
  guarantorLastName?: string;

  @Prop({ default: null })
  guarantorPhone?: string;

  @Prop({ default: null })
  guarantorEmail?: string;

  @Prop({ default: null })
  guarantorAddress?: string;

  @Prop({ default: null })
  guarantorEmploymentStatus?: string;

  @Prop({ default: null })
  guarantorCompany?: string;

  @Prop({ default: null })
  guarantorRelationship?: string;

  @Prop({ default: null })
  bankStatementUrl?: string;

  @Prop({ default: null })
  utilityBillUrl?: string;

  @Prop({ default: null })
  identificationDocumentUrl?: string;

  @Prop({ default: null })
  identificationDocumentType?: string;

  @Prop({ default: null })
  gender?: string;

  @Prop()
  createdBy: string;

  @Prop({ type: Object, default: null })
  personalReport?: {
    status: string;
    comment: string;
    reviewedBy: string;
    reviewedAt: Date;
  };

  @Prop({ type: Object, default: null })
  employmentReport?: {
    status: string;
    comment: string;
    reviewedBy: string;
    reviewedAt: Date;
  };

  @Prop({ type: Object, default: null })
  guarantorReport?: {
    status: string;
    comment: string;
    reviewedBy: string;
    reviewedAt: Date;
  };

  @Prop({ type: Object, default: null })
  documentsReport?: {
    status: string;
    comment: string;
    reviewedBy: string;
    reviewedAt: Date;
  };

  @Prop({ type: Object, default: null })
  phoneVerificationResult?: {
    status?: string;
    error?: string;
    data?: Record<string, unknown>;
    entity?: Record<string, unknown>;
    timestamp?: Date;
    originalError?: unknown;
    originalPhone?: string;
    finalPhone?: string;
    [key: string]: unknown;
  };

  @Prop({ default: null })
  phoneVerificationStatus?: string;

  @Prop({ default: null })
  phoneVerificationDate?: Date;

  @Prop({ type: Object, default: null })
  ninVerificationResult?: {
    status?: string;
    error?: string;
    data?: Record<string, unknown>;
    entity?: Record<string, unknown>;
    timestamp?: Date;
    originalError?: unknown;
    originalNin?: string;
    [key: string]: unknown;
  };

  @Prop({ default: null })
  ninVerificationStatus?: string;

  @Prop({ default: null })
  ninVerificationDate?: Date;
}

export const VerificationResponseSchema = SchemaFactory.createForClass(VerificationResponse);
