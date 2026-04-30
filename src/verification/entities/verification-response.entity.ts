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

  @Prop({ type: Object, default: null })
  identificationDocumentAnalysis?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  utilityBillAnalysis?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  creditSummary?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  phoneFraudResult?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  amlScreeningResult?: Record<string, unknown> | null;

  /** Set when "Run all checks" has completed (all steps attempted). */
  @Prop({ default: null })
  allChecksCompletedAt?: Date;

  /** Email/webhook to admins already sent for “all documents uploaded” (dedupe). */
  @Prop({ default: null })
  adminDocumentsSubmittedNotifiedAt?: Date;

  /** Email/webhook to landlord already sent for screening complete (dedupe). */
  @Prop({ default: null })
  landlordScreeningCompleteNotifiedAt?: Date;

  /** In-app admin notification already sent when screening / report finished (dedupe). */
  @Prop({ default: null })
  adminScreeningCompleteNotifiedAt?: Date;

  /**
   * Privacy-safe summary report for the landlord. No PII – only high-level outcomes.
   * Regenerated when all checks complete or on demand.
   */
  @Prop({ type: Object, default: null })
  landlordReport?: {
    generatedAt: Date;
    nin: 'verified' | 'failed' | 'not_run' | 'not_provided';
    aml: 'low_risk' | 'medium_risk' | 'high_risk' | 'not_run' | 'error';
    phone: 'valid' | 'invalid' | 'not_run' | 'not_provided';
    creditSummary: 'available' | 'not_available' | 'not_run' | 'not_provided';
    idDocument: 'verified' | 'failed' | 'not_run' | 'not_provided';
    utilityBill: 'verified' | 'failed' | 'not_run' | 'not_provided';
    personalSection: 'approved' | 'pending' | 'rejected' | 'not_reviewed';
    employmentSection: 'approved' | 'pending' | 'rejected' | 'not_reviewed';
    guarantorSection: 'approved' | 'pending' | 'rejected' | 'not_reviewed';
    documentsSection: 'approved' | 'pending' | 'rejected' | 'not_reviewed';
    /** Tenant Trust Score 0–100 (computed from verification outcomes). */
    riskScore?: number;
    /** Risk category from score bands. */
    riskCategory?: string;
    /** Landlord-facing recommendation. */
    recommendation?: string;
  } | null;
}

export const VerificationResponseSchema = SchemaFactory.createForClass(VerificationResponse);

VerificationResponseSchema.index({ verificationId: 1, email: 1 });
