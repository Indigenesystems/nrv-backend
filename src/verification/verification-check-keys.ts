export const VERIFICATION_CHECK_KEYS = [
  'nin',
  'phoneFraud',
  'creditSummary',
  'aml',
  'idDocument',
  'utilityBill',
] as const;

export type VerificationCheckKey = (typeof VERIFICATION_CHECK_KEYS)[number];

export type VerificationCheckRunStatus = 'ok' | 'error' | 'skipped' | 'cached';

export type VerificationChecksSummary = Record<
  VerificationCheckKey,
  VerificationCheckRunStatus
>;
