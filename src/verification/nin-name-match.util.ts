/** Trim, lowercase, collapse spaces — used for case-insensitive name comparison. */
export const normalizePersonName = (name: string | null | undefined): string => {
  if (name == null || typeof name !== 'string') {
    return '';
  }
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const toYyyyMmDd = (year: number, month: number, day: number): string => {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Dojah NIN `date_of_birth` is DD-MM-YYYY (e.g. 03-05-1996 = 3 May 1996).
 * Order: day, month, year.
 */
export const normalizeDojahDobForCompare = (
  value: string | Date | null | undefined,
): string => {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }
    return toYyyyMmDd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    return toYyyyMmDd(year, month, day);
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return toYyyyMmDd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return '';
};

/** Applicant DOB from DB/form — prefer ISO YYYY-MM-DD or Date (not locale display strings). */
export const normalizeApplicantDobForCompare = (
  value: string | Date | null | undefined,
): string => {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }
    return toYyyyMmDd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    return toYyyyMmDd(year, month, day);
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return toYyyyMmDd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return '';
};

/** @deprecated Use normalizeDojahDobForCompare or normalizeApplicantDobForCompare */
export const normalizeDobForCompare = normalizeApplicantDobForCompare;

/** Dojah entity field order: date_of_birth (DD-MM-YYYY string). */
export const getNinDobFromEntity = (
  entity: Record<string, unknown>,
): string | Date | null | undefined => {
  const raw =
    entity.date_of_birth ??
    entity.dateOfBirth ??
    entity.birthdate ??
    entity.birth_date ??
    entity.dob;
  if (raw == null) {
    return undefined;
  }
  if (typeof raw === 'string' || raw instanceof Date) {
    return raw;
  }
  return String(raw);
};

/** Dojah NIN name field order: first_name, middle_name, last_name. */
export const getNinEntityNameParts = (entity: Record<string, unknown>): {
  first: string;
  middle: string;
  last: string;
} => {
  const first =
    (entity.first_name as string) ?? (entity.firstName as string) ?? '';
  const middle =
    (entity.middle_name as string) ?? (entity.middleName as string) ?? '';
  const last =
    (entity.last_name as string) ?? (entity.lastName as string) ?? '';
  return { first, middle, last };
};

/** Full name in Dojah field order (first middle last), case-insensitive compare helper. */
export const ninFullNameFromEntity = (entity: Record<string, unknown>): string => {
  const { first, middle, last } = getNinEntityNameParts(entity);
  return normalizePersonName([first, middle, last].filter(Boolean).join(' '));
};

export const applicantFirstLastFromFullName = (
  fullName: string | null | undefined,
): { first: string; last: string } => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: '', last: '' };
  }
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  return { first: parts[0], last: parts[parts.length - 1] };
};

/** Pull NIN identity fields from common Dojah response shapes. */
export const resolveDojahNinEntity = (
  verificationResult: unknown,
): Record<string, unknown> | null => {
  if (!verificationResult || typeof verificationResult !== 'object') {
    return null;
  }
  const root = verificationResult as Record<string, unknown>;
  if (root.entity && typeof root.entity === 'object') {
    return root.entity as Record<string, unknown>;
  }
  const data = root.data;
  if (data && typeof data === 'object') {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.entity && typeof dataObj.entity === 'object') {
      return dataObj.entity as Record<string, unknown>;
    }
    if (dataObj.first_name || dataObj.firstName || dataObj.last_name || dataObj.lastName) {
      return dataObj;
    }
  }
  if (root.first_name || root.firstName || root.last_name || root.lastName) {
    return root;
  }
  return null;
};

/**
 * Compare tenant full name to NIN record (first + last; NIN middle ignored).
 * All name comparisons are case-insensitive.
 */
export const checkNinNameAlignment = (
  entity: Record<string, unknown> | null | undefined,
  applicantFullName: string | null | undefined,
  applicantDob?: string | Date | null,
): { namesMatch: boolean; dobMatch: boolean } => {
  const applicantNameNorm = normalizePersonName(applicantFullName);
  const applicantDobNorm = normalizeApplicantDobForCompare(applicantDob);

  let namesMatch = false;
  let dobMatch = false;

  if (entity && typeof entity === 'object') {
    const { first, middle, last } = getNinEntityNameParts(entity);
    const ninFirstNorm = normalizePersonName(first);
    const ninLastNorm = normalizePersonName(last);
    const { first: appFirst, last: appLast } = applicantFirstLastFromFullName(applicantFullName);
    const appFirstNorm = normalizePersonName(appFirst);
    const appLastNorm = normalizePersonName(appLast);

    if (ninFirstNorm && ninLastNorm && appFirstNorm && appLastNorm) {
      namesMatch = appFirstNorm === ninFirstNorm && appLastNorm === ninLastNorm;
    }

    if (!namesMatch) {
      const ninNameNorm = ninFullNameFromEntity(entity);
      namesMatch =
        applicantNameNorm !== '' &&
        ninNameNorm !== '' &&
        (ninNameNorm === applicantNameNorm ||
          applicantNameNorm.includes(ninNameNorm) ||
          ninNameNorm.includes(applicantNameNorm));
    }

    const ninDobNorm = normalizeDojahDobForCompare(getNinDobFromEntity(entity));
    dobMatch = applicantDobNorm !== '' && ninDobNorm !== '' && ninDobNorm === applicantDobNorm;
  }

  return { namesMatch, dobMatch };
};

export type NinAlignmentDoc = {
  fullName?: string | null;
  dateOfBirth?: string | Date | null;
  ninVerificationResult?: unknown;
};

/** Prefer live NIN entity vs applicant profile (case-insensitive names, normalized DOB). */
export const getNinAlignmentForDoc = (
  doc: NinAlignmentDoc,
): { namesMatch: boolean; dobMatch: boolean } => {
  const entity = resolveDojahNinEntity(doc.ninVerificationResult);
  const fullName = (doc.fullName || '').trim();
  if (!entity || !fullName) {
    const stored = doc.ninVerificationResult as
      | { namesMatch?: boolean; dobMatch?: boolean }
      | null
      | undefined;
    return {
      namesMatch: stored?.namesMatch === true,
      dobMatch: stored?.dobMatch === true,
    };
  }
  return checkNinNameAlignment(entity, fullName, doc.dateOfBirth);
};
