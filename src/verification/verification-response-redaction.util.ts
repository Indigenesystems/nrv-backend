import {
  identificationDocumentAnalysisOutcome,
  maskDigits,
  redactDeepForLog,
  utilityBillAnalysisOutcome,
} from './dojah-logging';
import { getNinAlignmentForDoc } from './nin-name-match.util';
import { extractPhoneFraudEntity, isPhoneFraudEntityValid } from './phone-fraud.util';

export const REDACTED_ON_FILE = 'On file (redacted)';

const redactNinVerificationResult = (
  value: unknown,
  doc: Record<string, unknown>,
): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const src = value as Record<string, unknown>;
  const alignment = getNinAlignmentForDoc({
    fullName: String(doc.fullName ?? ''),
    dateOfBirth: doc.dateOfBirth as string | Date | null | undefined,
    ninVerificationResult: src,
  });

  return {
    status: src.status,
    namesMatch:
      typeof src.namesMatch === 'boolean' ? src.namesMatch : alignment.namesMatch,
    dobMatch: typeof src.dobMatch === 'boolean' ? src.dobMatch : alignment.dobMatch,
    error: src.error != null ? '[present]' : undefined,
    timestamp: src.timestamp,
  };
};

const redactCreditSummary = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const src = value as Record<string, unknown>;
  const entity = (src.entity ?? src.data) as Record<string, unknown> | undefined;
  if (!entity || typeof entity !== 'object') {
    return redactDeepForLog(src) as Record<string, unknown>;
  }
  const score = entity.score as Record<string, unknown> | undefined;
  return {
    status: src.status,
    entity: {
      score: score
        ? {
            bureauStatus: score.bureauStatus,
            totalBorrowed: score.totalBorrowed,
            totalOutstanding: score.totalOutstanding,
            totalNoOfActiveLoans: score.totalNoOfActiveLoans,
            totalNoOfLoans: score.totalNoOfLoans,
          }
        : undefined,
      name: entity.name ? REDACTED_ON_FILE : undefined,
      bvn: entity.bvn ? REDACTED_ON_FILE : undefined,
      phone: entity.phone ? maskDigits(String(entity.phone).replace(/\D/g, ''), 4) : undefined,
      dateOfBirth: entity.dateOfBirth ? REDACTED_ON_FILE : undefined,
      gender: entity.gender,
      address: entity.address ? REDACTED_ON_FILE : undefined,
    },
  };
};

const redactAmlScreeningResult = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const src = value as Record<string, unknown>;
  const entity = (src.entity ?? src.data ?? src) as Record<string, unknown>;
  const results = Array.isArray(entity.results) ? entity.results : [];
  return {
    reference_id: src.reference_id,
    entity: {
      risk_level: entity.risk_level,
      match_status: entity.match_status,
      match_found: entity.match_found,
      total_results: entity.total_results,
      status: entity.status,
      results: results.slice(0, 10).map((row: Record<string, unknown>, index: number) => ({
        index: index + 1,
        source_type: row.source_type,
        match: row.match,
        score: row.score,
        name: row.name ? REDACTED_ON_FILE : undefined,
      })),
    },
  };
};

const redactPhoneFraudResult = (
  value: unknown,
  phone?: unknown,
): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const src = value as Record<string, unknown>;
  const entity = extractPhoneFraudEntity(src);
  const resolvedValid = isPhoneFraudEntityValid(entity);
  return {
    entity: {
      phone:
        phone != null && String(phone).trim()
          ? maskDigits(String(phone).replace(/\D/g, ''), 4)
          : entity?.phone != null
            ? maskDigits(String(entity.phone).replace(/\D/g, ''), 4)
            : undefined,
      valid: entity?.valid ?? resolvedValid,
      active: entity?.active,
      network: entity?.network,
      line_type: entity?.line_type,
      fraud_score: entity?.fraud_score,
      risk_level: entity?.risk_level,
      status: entity?.status,
      message: entity?.message,
    },
  };
};

/** Strip PII from verification response payloads returned to admin panels. */
export const redactVerificationResponseForAdmin = (
  doc: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  if (!doc) {
    return null;
  }

  const out: Record<string, unknown> = { ...doc };

  if (out.nin != null && String(out.nin).trim()) {
    out.nin = REDACTED_ON_FILE;
  }
  if (out.bvn != null && String(out.bvn).trim()) {
    out.bvn = REDACTED_ON_FILE;
  }

  out.ninVerificationResult = redactNinVerificationResult(
    out.ninVerificationResult,
    doc,
  );
  out.creditSummary = redactCreditSummary(out.creditSummary);
  out.amlScreeningResult = redactAmlScreeningResult(out.amlScreeningResult);
  out.phoneFraudResult = redactPhoneFraudResult(out.phoneFraudResult, out.phone);

  if (out.identificationDocumentAnalysis != null) {
    out.identificationDocumentAnalysis = identificationDocumentAnalysisOutcome(
      out.identificationDocumentAnalysis,
    );
  }
  if (out.utilityBillAnalysis != null) {
    out.utilityBillAnalysis = utilityBillAnalysisOutcome(out.utilityBillAnalysis);
  }

  return out;
};
