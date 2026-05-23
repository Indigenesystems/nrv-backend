import type { DocForRisk } from './verification-risk-display.util';

/** Parse monthly income from number or currency string (e.g. "500000", "₦500,000"). */
export const coerceMonthlyIncome = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? value : null;
  }
  const digits = String(value).replace(/[^\d.-]/g, '');
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
};

export const resolveEmployerName = (doc: Record<string, unknown>): string => {
  const keys = ['companyName', 'employerName', 'nameOfCompany', 'currentEmployer', 'employer'];
  for (const key of keys) {
    const s = String(doc[key] ?? '').trim();
    if (s) {
      return s;
    }
  }
  return '';
};

export const hasGuarantorIdentity = (doc: Record<string, unknown>): boolean => {
  if (
    String(doc.guarantorFirstName ?? '').trim() ||
    String(doc.guarantorLastName ?? '').trim()
  ) {
    return true;
  }
  const full = String(doc.guarantorName ?? doc.guarantorFullName ?? '').trim();
  return full.length > 0;
};

export const hasGuarantorContact = (doc: Record<string, unknown>): boolean => {
  return !!(
    String(doc.guarantorPhone ?? '').trim() || String(doc.guarantorEmail ?? '').trim()
  );
};

/** Normalize response document fields used for employment / guarantor risk scoring. */
export const buildDocForRiskFromResponse = (
  doc: Record<string, unknown>,
): DocForRisk => {
  const income = coerceMonthlyIncome(doc.monthlyIncome);
  const employer = resolveEmployerName(doc);
  return {
    ...(doc as DocForRisk),
    monthlyIncome: income,
    companyName: employer || String(doc.companyName ?? '').trim() || null,
  };
};
