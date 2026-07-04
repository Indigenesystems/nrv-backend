export type AmlLandlordStatus =
  | 'low_risk'
  | 'medium_risk'
  | 'high_risk'
  | 'not_run'
  | 'error';

/**
 * Map Dojah AML v2 screening payload to landlord report AML status.
 * Does not default unknown payloads to low_risk when matches are present.
 */
export const resolveAmlLandlordStatus = (
  amlScreeningResult: Record<string, unknown> | null | undefined,
): AmlLandlordStatus => {
  if (!amlScreeningResult) {
    return 'not_run';
  }

  if (amlScreeningResult.error) {
    return 'error';
  }

  const entity = (amlScreeningResult.entity ??
    amlScreeningResult.data ??
    amlScreeningResult) as Record<string, unknown>;

  const riskLevel = String(entity.risk_level ?? '').toLowerCase();
  if (riskLevel === 'low') {
    return 'low_risk';
  }
  if (riskLevel === 'medium') {
    return 'medium_risk';
  }
  if (riskLevel === 'high') {
    return 'high_risk';
  }

  const results = Array.isArray(entity.results) ? entity.results : [];
  const matchFound = entity.match_found === true || results.length > 0;

  if (matchFound) {
    const topScore = results.reduce((max, row) => {
      const score = Number((row as Record<string, unknown>)?.score);
      return Number.isFinite(score) ? Math.max(max, score) : max;
    }, 0);

    if (topScore >= 0.85) {
      return 'high_risk';
    }
    if (topScore >= 0.6) {
      return 'medium_risk';
    }
    return 'medium_risk';
  }

  if (entity.risk_level === undefined && !matchFound) {
    return 'low_risk';
  }

  return 'not_run';
};
