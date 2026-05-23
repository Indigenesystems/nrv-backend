import {
  CreditFinancialSnapshot,
  creditFinancialScoreComponent,
} from './credit-financial.util';
import {
  getIdDocumentNinAlignmentForDoc,
  resolveIdDocumentLandlordStatus,
} from './id-document.util';
import {
  identificationDocumentAnalysisOutcome,
  maskDigits,
  redactDeepForLog,
  utilityBillAnalysisOutcome,
} from './dojah-logging';
import { getNinAlignmentForDoc } from './nin-name-match.util';
import { resolveUtilityBillLandlordStatus } from './utility-bill.util';
import {
  buildDocForRiskFromResponse,
  coerceMonthlyIncome,
  hasGuarantorContact,
  hasGuarantorIdentity,
  resolveEmployerName,
} from './verification-doc-for-risk.util';

export type RiskBreakdownCheck = {
  name: string;
  outcome: string;
  contribution: string;
};

export type RiskBreakdownCategory = {
  key: string;
  label: string;
  maxPoints: number;
  earnedPoints: number;
  statusSummary: string;
  checks: RiskBreakdownCheck[];
};

export type RedactedCheckSummary = {
  checkKey: string;
  label: string;
  ran: boolean;
  ok: boolean;
  fields: Record<string, unknown>;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Category point caps (sum = 100 per tier).
 * Standard omits rental (18) and financial/credit bureau (15); those 33 pts are
 * redistributed proportionally across identity, contact, employment, guarantor, compliance.
 */
export const RISK_WEIGHTS_BY_TIER = {
  standard: {
    identity: 33,
    contact: 19,
    employment: 22,
    financial: 0,
    rental: 0,
    guarantor: 15,
    compliance: 11,
  },
  premium: {
    identity: 22,
    contact: 13,
    employment: 15,
    financial: 15,
    rental: 18,
    guarantor: 10,
    compliance: 7,
  },
} as const;

export const getRiskWeightsTotal = (tier: 'standard' | 'premium'): number => {
  const w = RISK_WEIGHTS_BY_TIER[tier];
  return (
    w.identity +
    w.contact +
    w.employment +
    w.financial +
    w.rental +
    w.guarantor +
    w.compliance
  );
};

export type CategoryScores = ReturnType<typeof computeCategoryScores>;

export const computeWeightedRiskRaw = (
  scores: CategoryScores,
  tier: 'standard' | 'premium',
): number => {
  const w = RISK_WEIGHTS_BY_TIER[tier];
  return (
    scores.identityScore * w.identity +
    scores.contactScore * w.contact +
    scores.employmentScore * w.employment +
    scores.financialScore * w.financial +
    scores.rentalScore * w.rental +
    scores.guarantorScore * w.guarantor +
    scores.complianceScore * w.compliance
  );
};

/** Clamp weighted raw score to 0–100 (weights per tier already sum to 100). */
export const normalizeRiskScore = (
  raw: number,
  _tier: 'standard' | 'premium',
): number => {
  return Math.round(Math.max(0, Math.min(100, raw)));
};

const sectionScore = (s: string) =>
  s === 'approved' ? 1 : s === 'pending' ? 0.5 : s === 'rejected' ? 0 : 0.25;

export type LandlordReportForRisk = {
  nin: string;
  aml: string;
  phone: string;
  idDocument: string;
  utilityBill: string;
  personalSection: string;
  employmentSection: string;
  guarantorSection: string;
  documentsSection: string;
  creditSummary?: string;
};

export type DocForRisk = {
  fullName?: string | null;
  dateOfBirth?: string | Date | null;
  nin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  monthlyIncome?: number | null;
  companyName?: string | null;
  guarantorFirstName?: string | null;
  guarantorLastName?: string | null;
  guarantorPhone?: string | null;
  guarantorEmail?: string | null;
  bvn?: string | null;
  ninVerificationResult?: {
    namesMatch?: boolean;
    dobMatch?: boolean;
    status?: string;
    error?: unknown;
  } | null;
  ninVerificationStatus?: string | null;
  phoneFraudResult?: Record<string, unknown> | null;
  amlScreeningResult?: Record<string, unknown> | null;
  creditFinancialSnapshot?: CreditFinancialSnapshot | null;
  identificationDocumentAnalysis?: Record<string, unknown> | null;
  utilityBillUrl?: string | null;
  utilityBillAnalysis?: Record<string, unknown> | null;
  identificationDocumentUrl?: string | null;
};

export const computeCategoryScores = (
  doc: DocForRisk,
  report: LandlordReportForRisk,
  tier: 'standard' | 'premium',
): {
  identityScore: number;
  contactScore: number;
  employmentScore: number;
  financialScore: number;
  rentalScore: number;
  guarantorScore: number;
  complianceScore: number;
} => {
  const ninOk = report.nin === 'verified';
  const { namesMatch, dobMatch } = getNinAlignmentForDoc(doc);
  const idOk = report.idDocument === 'verified';
  const identityScore =
    (ninOk ? 0.4 : 0) +
    (namesMatch ? 0.2 : 0) +
    (dobMatch ? 0.2 : 0) +
    (idOk ? 0.2 : 0);

  const contactScore =
    (report.phone === 'valid' ? 0.35 : report.phone === 'invalid' ? 0 : 0.2) +
    (report.utilityBill === 'verified' ? 0.35 : report.utilityBill === 'failed' ? 0 : 0.15) +
    (doc.email ? 0.15 : 0) +
    (doc.address ? 0.15 : 0);

  const docRecord = doc as unknown as Record<string, unknown>;
  const monthlyIncome = coerceMonthlyIncome(doc.monthlyIncome);
  const employerName = resolveEmployerName(docRecord);
  const employmentScore =
    sectionScore(report.employmentSection) * 0.5 +
    (monthlyIncome != null ? 0.25 : 0) +
    (employerName ? 0.25 : 0);

  const financialScore = creditFinancialScoreComponent(
    doc.creditFinancialSnapshot ?? null,
    tier,
    !!doc.bvn?.trim(),
  );

  const rentalScore =
    sectionScore(report.documentsSection) * 0.5 +
    sectionScore(report.personalSection) * 0.5;

  const guarantorScore =
    sectionScore(report.guarantorSection) * 0.6 +
    (hasGuarantorIdentity(docRecord) ? 0.2 : 0) +
    (hasGuarantorContact(docRecord) ? 0.2 : 0);

  const complianceScore =
    report.aml === 'low_risk'
      ? 1
      : report.aml === 'medium_risk'
        ? 0.6
        : report.aml === 'high_risk'
          ? 0.2
          : 0.3;

  return {
    identityScore,
    contactScore: Math.min(1, contactScore),
    employmentScore,
    financialScore,
    rentalScore,
    guarantorScore,
    complianceScore: Math.min(1, complianceScore),
  };
};

export const buildTenantRiskBreakdown = (
  doc: DocForRisk,
  report: LandlordReportForRisk,
  tier: 'standard' | 'premium',
): RiskBreakdownCategory[] => {
  const scores = computeCategoryScores(doc, report, tier);
  const ninAlignment = getNinAlignmentForDoc(doc);
  const idNinAlignment = getIdDocumentNinAlignmentForDoc(doc);

  const idDocumentContribution = idNinAlignment.authentic
    ? 'authentic · NIN name match'
    : idNinAlignment.technicallyValid && !idNinAlignment.namesMatch
      ? 'name mismatch with NIN'
      : idNinAlignment.mismatchReason === 'document_not_valid'
        ? 'document invalid'
        : idNinAlignment.mismatchReason === 'no_name_on_document'
          ? 'no name extracted'
          : '20% of category';

  const identityChecks: RiskBreakdownCheck[] = [
    {
      name: 'NIN verification',
      outcome: report.nin,
      contribution: ninAlignment.namesMatch ? 'name match' : '—',
    },
    {
      name: 'Name match',
      outcome: ninAlignment.namesMatch ? 'yes' : 'no',
      contribution: '20% of category',
    },
    {
      name: 'DOB match',
      outcome: ninAlignment.dobMatch ? 'yes' : 'no',
      contribution: '20% of category',
    },
    {
      name: 'ID document',
      outcome: report.idDocument,
      contribution: idDocumentContribution,
    },
  ];

  const contactChecks: RiskBreakdownCheck[] = [
    { name: 'Phone fraud', outcome: report.phone, contribution: '35% of category' },
    {
      name: 'Utility bill / address',
      outcome: report.utilityBill,
      contribution: '35% of category',
    },
    {
      name: 'Email on file',
      outcome: doc.email?.trim() ? 'provided' : 'missing',
      contribution: '15% of category',
    },
    {
      name: 'Address on file',
      outcome: doc.address?.trim() ? 'provided' : 'missing',
      contribution: '15% of category',
    },
  ];

  const financialChecks: RiskBreakdownCheck[] =
    tier === 'premium' && doc.bvn?.trim()
      ? [
          {
            name: 'Credit bureau',
            outcome: report.creditSummary ?? 'not_run',
            contribution: 'affordability band',
          },
          {
            name: 'Debt-to-income',
            outcome:
              doc.creditFinancialSnapshot?.debtToIncomeRatio != null
                ? `${Math.round(doc.creditFinancialSnapshot.debtToIncomeRatio * 100)}%`
                : 'n/a',
            contribution: 'from bureau + stated income',
          },
        ]
      : [
          {
            name: 'Credit bureau',
            outcome: tier === 'premium' ? 'not_provided' : 'standard tier',
            contribution: 'premium + BVN required',
          },
        ];

  const w = RISK_WEIGHTS_BY_TIER[tier];

  const categories: RiskBreakdownCategory[] = [
    {
      key: 'identity',
      label: 'Identity Integrity',
      maxPoints: w.identity,
      earnedPoints: round1(scores.identityScore * w.identity),
      statusSummary: `${report.nin} · ${report.idDocument}`,
      checks: identityChecks,
    },
    {
      key: 'contact',
      label: 'Contact & Address Verifiability',
      maxPoints: w.contact,
      earnedPoints: round1(scores.contactScore * w.contact),
      statusSummary: `${report.phone} · ${report.utilityBill}`,
      checks: contactChecks,
    },
    {
      key: 'employment',
      label: 'Employment & Income Stability',
      maxPoints: w.employment,
      earnedPoints: round1(scores.employmentScore * w.employment),
      statusSummary: report.employmentSection,
      checks: [
        {
          name: 'Employment review',
          outcome: report.employmentSection,
          contribution: '50% of category',
        },
        {
          name: 'Monthly income',
          outcome:
            coerceMonthlyIncome(doc.monthlyIncome) != null ? 'declared' : 'missing',
          contribution: '25% of category',
        },
        {
          name: 'Employer',
          outcome: resolveEmployerName(doc as unknown as Record<string, unknown>)
            ? 'provided'
            : 'missing',
          contribution: '25% of category',
        },
      ],
    },
  ];

  if (tier === 'premium' && w.financial > 0) {
    categories.push({
      key: 'financial',
      label: 'Financial Capacity (Credit)',
      maxPoints: w.financial,
      earnedPoints: round1(scores.financialScore * w.financial),
      statusSummary: report.creditSummary ?? 'not_run',
      checks: financialChecks,
    });
  }

  if (tier === 'premium' && w.rental > 0) {
    categories.push({
      key: 'rental',
      label: 'Rental Reliability',
      maxPoints: w.rental,
      earnedPoints: round1(scores.rentalScore * w.rental),
      statusSummary: `${report.documentsSection} · ${report.personalSection}`,
      checks: [
        {
          name: 'Documents review',
          outcome: report.documentsSection,
          contribution: '50% of category',
        },
        {
          name: 'Personal section',
          outcome: report.personalSection,
          contribution: '50% of category',
        },
      ],
    });
  }

  categories.push(
    {
      key: 'guarantor',
      label: 'Guarantor Strength',
      maxPoints: w.guarantor,
      earnedPoints: round1(scores.guarantorScore * w.guarantor),
      statusSummary: report.guarantorSection,
      checks: [
        {
          name: 'Guarantor review',
          outcome: report.guarantorSection,
          contribution: '60% of category',
        },
        {
          name: 'Guarantor identity',
          outcome: hasGuarantorIdentity(doc as unknown as Record<string, unknown>)
            ? 'provided'
            : 'missing',
          contribution: '20% of category',
        },
        {
          name: 'Guarantor contact',
          outcome: hasGuarantorContact(doc as unknown as Record<string, unknown>)
            ? 'provided'
            : 'missing',
          contribution: '20% of category',
        },
      ],
    },
    {
      key: 'compliance',
      label: 'Compliance & Risk Signals',
      maxPoints: w.compliance,
      earnedPoints: round1(scores.complianceScore * w.compliance),
      statusSummary: report.aml,
      checks: [
        { name: 'AML screening', outcome: report.aml, contribution: 'PEP / sanctions / media' },
      ],
    },
  );

  return categories;
};

const maskNin = (nin?: string | null) =>
  nin?.trim() ? maskDigits(nin.replace(/\D/g, ''), 4) : undefined;

const maskBvn = (bvn?: string | null) =>
  bvn?.trim() ? maskDigits(bvn.replace(/\D/g, ''), 4) : undefined;

const redactAmlForDisplay = (
  aml: Record<string, unknown> | null | undefined,
): { ran: boolean; ok: boolean; fields: Record<string, unknown> } => {
  if (!aml) {
    return { ran: false, ok: false, fields: {} };
  }
  const entity = (aml.entity ?? aml.data ?? aml) as Record<string, unknown>;
  const results = Array.isArray(entity.results) ? entity.results : [];
  const risk = String(entity.risk_level ?? '').toLowerCase();
  const ok = risk === 'low' || risk === 'medium' || (!!entity && !aml.error);
  return {
    ran: true,
    ok,
    fields: redactDeepForLog({
      risk_level: entity.risk_level,
      match_found: entity.match_found,
      reference_id: aml.reference_id,
      screening_status: entity.status,
      result_count: results.length,
      top_matches: results.slice(0, 5).map((r: Record<string, unknown>, i: number) => ({
        index: i + 1,
        source_type: r.source_type,
        match: r.match,
        score: r.score,
        name: r.name ? '[redacted]' : undefined,
      })),
    }) as Record<string, unknown>,
  };
};

const redactPhoneFraudForDisplay = (
  pf: Record<string, unknown> | null | undefined,
  phone?: string | null,
): { ran: boolean; ok: boolean; fields: Record<string, unknown> } => {
  if (!pf) {
    return { ran: false, ok: false, fields: {} };
  }
  const entity = (pf.entity ?? pf.data ?? pf) as Record<string, unknown>;
  const valid = entity.valid === true;
  return {
    ran: true,
    ok: valid && !pf.error,
    fields: redactDeepForLog({
      phone: phone?.trim() ? maskDigits(phone.replace(/\D/g, ''), 4) : undefined,
      valid: entity.valid,
      active: entity.active,
      network: entity.network,
      line_type: entity.line_type,
      fraud_score: entity.fraud_score,
      risk_level: entity.risk_level,
      status: entity.status,
      message: entity.message,
    }) as Record<string, unknown>,
  };
};

const redactNinForDisplay = (
  doc: DocForRisk,
): { ran: boolean; ok: boolean; fields: Record<string, unknown> } => {
  const result = doc.ninVerificationResult;
  const alignment = getNinAlignmentForDoc(doc);
  const ok =
    doc.ninVerificationStatus === 'completed' || result?.status === 'success';
  return {
    ran: !!result || !!doc.ninVerificationStatus,
    ok,
    fields: redactDeepForLog({
      nin: maskNin(doc.nin),
      status: doc.ninVerificationStatus ?? result?.status,
      names_match: alignment.namesMatch,
      dob_match: alignment.dobMatch,
      error: result?.error ? '[present]' : undefined,
    }) as Record<string, unknown>,
  };
};

export const buildRedactedVerificationCheckSummaries = (
  doc: DocForRisk,
  tier: 'standard' | 'premium',
): RedactedCheckSummary[] => {
  const nin = redactNinForDisplay(doc);
  const phone = redactPhoneFraudForDisplay(doc.phoneFraudResult, doc.phone);
  const aml = redactAmlForDisplay(doc.amlScreeningResult);
  const snap = doc.creditFinancialSnapshot;
  const credit = {
    ran: tier === 'premium' && !!doc.bvn?.trim() && !!snap,
    ok: snap?.status === 'ok',
    fields: redactDeepForLog({
      bvn: maskBvn(doc.bvn),
      status: snap?.status,
      affordability_band: snap?.affordabilityBand,
      debt_to_income_ratio: snap?.debtToIncomeRatio,
      total_outstanding_ngn: snap?.totalOutstandingNgn,
      active_loans: snap?.totalActiveLoans,
    }) as Record<string, unknown>,
  };
  const idAnalysis = doc.identificationDocumentAnalysis;
  const idNinAlignment = getIdDocumentNinAlignmentForDoc(doc);
  const idLandlordStatus = resolveIdDocumentLandlordStatus(
    doc.identificationDocumentUrl,
    idAnalysis,
    doc.ninVerificationResult,
  );
  const idDoc = {
    ran: !!doc.identificationDocumentUrl && !!idAnalysis,
    ok: idLandlordStatus === 'verified',
    fields: idAnalysis
      ? ({
          ...(identificationDocumentAnalysisOutcome(idAnalysis) as Record<string, unknown>),
          authentic: idNinAlignment.authentic,
          nin_name_match: idNinAlignment.namesMatch,
          nin_dob_match: idNinAlignment.dobMatch,
        } as Record<string, unknown>)
      : {},
  };
  const utilStatus = resolveUtilityBillLandlordStatus(
    doc.utilityBillUrl,
    doc.utilityBillAnalysis,
  );
  const util = {
    ran: !!doc.utilityBillUrl && !!doc.utilityBillAnalysis,
    ok: utilStatus === 'verified',
    fields: doc.utilityBillAnalysis
      ? (utilityBillAnalysisOutcome(doc.utilityBillAnalysis) as Record<string, unknown>)
      : {},
  };

  return [
    { checkKey: 'nin', label: 'NIN verification', ...nin },
    { checkKey: 'phoneFraud', label: 'Phone fraud screening', ...phone },
    { checkKey: 'creditSummary', label: 'Credit summary', ...credit },
    { checkKey: 'aml', label: 'AML screening', ...aml },
    { checkKey: 'idDocument', label: 'ID document analysis', ...idDoc },
    { checkKey: 'utilityBill', label: 'Utility bill analysis', ...util },
  ];
};
