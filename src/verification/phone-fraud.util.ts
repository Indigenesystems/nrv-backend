/**
 * Parse Dojah phone fraud screening payloads into a stable shape for landlord reports.
 * Sandbox and production responses differ: `valid` may be absent and fields may live under `entity.report`.
 */

export type PhoneLandlordStatus = 'valid' | 'invalid' | 'not_run' | 'not_provided';

const coerceTruthy = (value: unknown): boolean => {
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'valid';
  }
  return false;
};

const hasPhoneFraudSignals = (entity: Record<string, unknown>): boolean => {
  if (entity.phone != null && String(entity.phone).trim()) {
    return true;
  }
  const format = entity.format;
  if (format && typeof format === 'object' && !Array.isArray(format)) {
    const formatted = (format as Record<string, unknown>).formatted;
    if (formatted != null && String(formatted).trim()) {
      return true;
    }
  }
  const information = entity.information;
  if (information && typeof information === 'object' && !Array.isArray(information)) {
    const info = information as Record<string, unknown>;
    if (info.carrier != null || info.type != null || info.country != null) {
      return true;
    }
  }
  return (
    entity.risk_score != null ||
    entity.network != null ||
    entity.line_type != null ||
    entity.active != null
  );
};

/** Unwrap entity / entity.report / data.entity from a stored Dojah phone fraud result. */
export const extractPhoneFraudEntity = (result: unknown): Record<string, unknown> | null => {
  if (!result || typeof result !== 'object') {
    return null;
  }
  const root = result as Record<string, unknown>;
  if (root.error != null) {
    return null;
  }

  const candidates: unknown[] = [
    root.entity,
    (root.data as Record<string, unknown> | undefined)?.entity,
    root.data,
    root,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const report = record.report;
    if (report && typeof report === 'object' && !Array.isArray(report)) {
      return report as Record<string, unknown>;
    }
    if (
      'valid' in record ||
      'phone' in record ||
      'active' in record ||
      'risk_score' in record ||
      'information' in record ||
      'format' in record
    ) {
      return record;
    }
  }

  return null;
};

export const isPhoneFraudEntityValid = (entity: Record<string, unknown> | null | undefined): boolean => {
  if (!entity) {
    return false;
  }

  if ('valid' in entity) {
    return coerceTruthy(entity.valid);
  }

  if (coerceTruthy(entity.disposable) || coerceTruthy(entity.spammer) || coerceTruthy(entity.suspicious)) {
    return false;
  }

  if (coerceTruthy(entity.active)) {
    return true;
  }

  // Dojah sandbox often omits `valid` but still returns a formatted phone profile.
  return hasPhoneFraudSignals(entity);
};

export const resolvePhoneLandlordStatus = (
  phone: string | null | undefined,
  phoneFraudResult: unknown,
): PhoneLandlordStatus => {
  if (!phone?.trim()) {
    return 'not_provided';
  }
  if (!phoneFraudResult || typeof phoneFraudResult !== 'object') {
    return 'not_run';
  }
  const root = phoneFraudResult as Record<string, unknown>;
  if (root.error != null) {
    return 'invalid';
  }
  const entity = extractPhoneFraudEntity(phoneFraudResult);
  if (!entity) {
    return 'not_run';
  }
  return isPhoneFraudEntityValid(entity) ? 'valid' : 'invalid';
};
