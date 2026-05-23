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

  /** Bank Verification Number — required for premium credit bureau checks (not interchangeable with NIN). */
  @Prop({ default: null })
  bvn?: string;

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

  /** Parsed bureau affordability signals (no raw PII). */
  @Prop({ type: Object, default: null })
  creditFinancialSnapshot?: Record<string, unknown> | null;

  /**
   * Per-check Dojah fetch metadata for API reuse (inputs + fetched at).
   * Keys: nin, phoneFraud, creditSummary, aml, idDocument, utilityBill.
   */
  @Prop({ type: Object, default: null })
  dojahCheckCache?: Record<string, unknown> | null;

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
    creditSummary:
      | 'strong'
      | 'adequate'
      | 'stretched'
      | 'high_risk'
      | 'unknown'
      | 'no_hit'
      | 'error'
      | 'not_available'
      | 'not_run'
      | 'not_provided'
      | 'available';
    /** Same as affordability band when credit check succeeded; drives financial UI. */
    financialAffordability?:
      | 'strong'
      | 'adequate'
      | 'stretched'
      | 'high_risk'
      | 'unknown'
      | 'not_run';
    /** Rounded debt-to-income ratio (0–1+) when computable; no currency PII. */
    creditDebtToIncomeRatio?: number | null;
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
    /** Per-category weighted score (max points + earned). */
    riskBreakdown?: Array<{
      key: string;
      label: string;
      maxPoints: number;
      earnedPoints: number;
      statusSummary: string;
      checks: Array<{ name: string; outcome: string; contribution: string }>;
    }>;
    /** Privacy-safe Dojah / check response summaries (no NIN/BVN/images). */
    checkSummaries?: Array<{
      checkKey: string;
      label: string;
      ran: boolean;
      ok: boolean;
      fields: Record<string, unknown>;
    }>;
  } | null;
}

export const VerificationResponseSchema = SchemaFactory.createForClass(VerificationResponse);

VerificationResponseSchema.index({ verificationId: 1, email: 1 });
