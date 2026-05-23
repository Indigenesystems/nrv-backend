/**
 * Normalizes Dojah credit bureau responses into affordability signals for scoring and landlord reports.
 */

export type CreditFinancialStatus = 'ok' | 'no_hit' | 'error' | 'not_run';

export type CreditAffordabilityBand =
  | 'strong'
  | 'adequate'
  | 'stretched'
  | 'high_risk'
  | 'unknown';

export type LandlordCreditSummaryOutcome =
  | 'strong'
  | 'adequate'
  | 'stretched'
  | 'high_risk'
  | 'unknown'
  | 'no_hit'
  | 'error'
  | 'not_available'
  | 'not_run'
  | 'not_provided';

export interface CreditFinancialSnapshot {
  status: CreditFinancialStatus;
  affordabilityBand: CreditAffordabilityBand;
  /** Sum of outstanding debt across bureaus (NGN), when reported. */
  totalOutstandingNgn: number | null;
  totalActiveLoans: number | null;
  /** Outstanding / stated monthly income when both exist. */
  debtToIncomeRatio: number | null;
  /** Privacy-safe label for landlord report. */
  landlordCreditOutcome: LandlordCreditSummaryOutcome;
}

type ScoreMetric = { source?: string; value?: number };

const sumMetricValues = (items: ScoreMetric[] | undefined): number | null => {
  if (!items?.length) {
    return null;
  }
  let sum = 0;
  let hasValue = false;
  for (const item of items) {
    const v = item?.value;
    if (typeof v === 'number' && !Number.isNaN(v)) {
      sum += v;
      hasValue = true;
    }
  }
  return hasValue ? sum : null;
};

const maxMetricValues = (items: ScoreMetric[] | undefined): number | null => {
  if (!items?.length) {
    return null;
  }
  let max: number | null = null;
  for (const item of items) {
    const v = item?.value;
    if (typeof v === 'number' && !Number.isNaN(v)) {
      max = max == null ? v : Math.max(max, v);
    }
  }
  return max;
};

const extractEntity = (creditSummary: Record<string, unknown> | null | undefined) => {
  if (!creditSummary || typeof creditSummary !== 'object') {
    return null;
  }
  const entity = (creditSummary.entity ?? (creditSummary.data as Record<string, unknown>)?.entity) as
    | Record<string, unknown>
    | undefined;
  return entity && typeof entity === 'object' ? entity : null;
};

const isBureauNoHit = (bureauStatus: unknown): boolean => {
  if (bureauStatus == null) {
    return false;
  }
  if (typeof bureauStatus === 'string') {
    const s = bureauStatus.toLowerCase();
    return s.includes('no') && (s.includes('record') || s.includes('hit') || s.includes('data'));
  }
  if (typeof bureauStatus === 'object' && !Array.isArray(bureauStatus)) {
    const values = Object.values(bureauStatus as Record<string, unknown>);
    if (!values.length) {
      return false;
    }
    return values.every((v) => isBureauNoHit(v));
  }
  return false;
};

const affordabilityFromMetrics = (
  totalOutstandingNgn: number | null,
  totalActiveLoans: number | null,
  debtToIncomeRatio: number | null,
): CreditAffordabilityBand => {
  if (debtToIncomeRatio != null) {
    if (debtToIncomeRatio >= 0.85) {
      return 'high_risk';
    }
    if (debtToIncomeRatio >= 0.55) {
      return 'stretched';
    }
    if (debtToIncomeRatio <= 0.35 && (totalActiveLoans ?? 0) <= 3) {
      return 'strong';
    }
    return 'adequate';
  }

  if (totalOutstandingNgn != null) {
    if (totalOutstandingNgn >= 3_000_000) {
      return 'high_risk';
    }
    if (totalOutstandingNgn >= 1_200_000) {
      return 'stretched';
    }
    if (totalOutstandingNgn <= 400_000 && (totalActiveLoans ?? 0) <= 2) {
      return 'strong';
    }
    return 'adequate';
  }

  if (totalActiveLoans != null && totalActiveLoans >= 6) {
    return 'stretched';
  }

  return 'adequate';
};

const bandToLandlordOutcome = (
  status: CreditFinancialStatus,
  band: CreditAffordabilityBand,
): LandlordCreditSummaryOutcome => {
  if (status === 'not_run') {
    return 'not_run';
  }
  if (status === 'error') {
    return 'error';
  }
  if (status === 'no_hit') {
    return 'no_hit';
  }
  if (band === 'strong') {
    return 'strong';
  }
  if (band === 'adequate') {
    return 'adequate';
  }
  if (band === 'stretched') {
    return 'stretched';
  }
  if (band === 'high_risk') {
    return 'high_risk';
  }
  return 'unknown';
};

/**
 * Parse raw Dojah credit summary JSON into a financial snapshot for scoring.
 */
export const parseCreditFinancialSnapshot = (
  creditSummary: Record<string, unknown> | null | undefined,
  monthlyIncome?: number | null,
): CreditFinancialSnapshot => {
  if (!creditSummary) {
    return {
      status: 'not_run',
      affordabilityBand: 'unknown',
      totalOutstandingNgn: null,
      totalActiveLoans: null,
      debtToIncomeRatio: null,
      landlordCreditOutcome: 'not_run',
    };
  }

  if ((creditSummary as { error?: unknown }).error != null) {
    return {
      status: 'error',
      affordabilityBand: 'unknown',
      totalOutstandingNgn: null,
      totalActiveLoans: null,
      debtToIncomeRatio: null,
      landlordCreditOutcome: 'error',
    };
  }

  const entity = extractEntity(creditSummary);
  if (!entity) {
    return {
      status: 'error',
      affordabilityBand: 'unknown',
      totalOutstandingNgn: null,
      totalActiveLoans: null,
      debtToIncomeRatio: null,
      landlordCreditOutcome: 'error',
    };
  }

  const score = entity.score as Record<string, unknown> | undefined;
  const bureauStatus = score?.bureauStatus;
  const totalOutstandingNgn = sumMetricValues(
    score?.totalOutstanding as ScoreMetric[] | undefined,
  );
  const totalActiveLoans = maxMetricValues(
    score?.totalNoOfActiveLoans as ScoreMetric[] | undefined,
  );

  const income =
    monthlyIncome != null && monthlyIncome > 0 ? monthlyIncome : null;
  const debtToIncomeRatio =
    income != null && totalOutstandingNgn != null && totalOutstandingNgn >= 0
      ? Math.round((totalOutstandingNgn / income) * 100) / 100
      : null;

  const hasMetrics =
    totalOutstandingNgn != null ||
    totalActiveLoans != null ||
    bureauStatus != null;

  if (!hasMetrics || isBureauNoHit(bureauStatus)) {
    return {
      status: 'no_hit',
      affordabilityBand: 'unknown',
      totalOutstandingNgn,
      totalActiveLoans,
      debtToIncomeRatio,
      landlordCreditOutcome: 'no_hit',
    };
  }

  const affordabilityBand = affordabilityFromMetrics(
    totalOutstandingNgn,
    totalActiveLoans,
    debtToIncomeRatio,
  );

  return {
    status: 'ok',
    affordabilityBand,
    totalOutstandingNgn,
    totalActiveLoans,
    debtToIncomeRatio,
    landlordCreditOutcome: bandToLandlordOutcome('ok', affordabilityBand),
  };
};

/** Score component 0–1 for trust score from snapshot and tier. */
export const creditFinancialScoreComponent = (
  snapshot: CreditFinancialSnapshot | null | undefined,
  tier: 'standard' | 'premium',
  hasBvn: boolean,
): number => {
  if (tier !== 'premium' || !hasBvn) {
    return 0.7;
  }
  if (!snapshot || snapshot.status === 'not_run') {
    return 0.45;
  }
  if (snapshot.status === 'error') {
    return 0.25;
  }
  if (snapshot.status === 'no_hit') {
    return 0.5;
  }
  switch (snapshot.affordabilityBand) {
    case 'strong':
      return 1;
    case 'adequate':
      return 0.78;
    case 'stretched':
      return 0.42;
    case 'high_risk':
      return 0.12;
    default:
      return 0.45;
  }
};

export const resolveLandlordCreditOutcome = (
  snapshot: CreditFinancialSnapshot | null | undefined,
  hasBvn: boolean,
): LandlordCreditSummaryOutcome => {
  if (!hasBvn) {
    return 'not_provided';
  }
  if (!snapshot || snapshot.status === 'not_run') {
    return 'not_available';
  }
  return snapshot.landlordCreditOutcome;
};
