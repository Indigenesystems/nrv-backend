import { formatPhoneForDojah } from './dojah-env.util';
import { VerificationCheckKey } from './verification-check-keys';
import { resolveIdDocumentLandlordStatus } from './id-document.util';
import { resolveUtilityBillLandlordStatus } from './utility-bill.util';

export type DojahCheckCacheEntry = {
  at: Date | string;
  nin?: string;
  phone?: string;
  bvn?: string;
  amlInputKey?: string;
  documentUrl?: string;
  billUrl?: string;
};

export type DojahCheckCacheMap = Partial<Record<VerificationCheckKey, DojahCheckCacheEntry>>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getDojahCheckCacheDays = (): number => {
  const raw = process.env.DOJAH_CHECK_CACHE_DAYS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0) {
      return n;
    }
  }
  return 7;
};

export const getDojahCheckCacheMaxAgeMs = (): number =>
  getDojahCheckCacheDays() * MS_PER_DAY;

export const isWithinDojahCheckCacheWindow = (fetchedAt: Date | string | undefined | null): boolean => {
  const maxAgeMs = getDojahCheckCacheMaxAgeMs();
  if (maxAgeMs <= 0 || !fetchedAt) {
    return false;
  }
  const at = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  if (Number.isNaN(at.getTime())) {
    return false;
  }
  return Date.now() - at.getTime() <= maxAgeMs;
};

const entryAt = (
  entry: DojahCheckCacheEntry | undefined,
  fallbackAt?: Date | string | null,
): Date | string | undefined => {
  if (entry?.at) {
    return entry.at;
  }
  return fallbackAt ?? undefined;
};

export const buildAmlInputKey = (params: {
  fullName?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
}): string => {
  const dob =
    params.dateOfBirth instanceof Date
      ? params.dateOfBirth.toISOString().slice(0, 10)
      : params.dateOfBirth
        ? String(params.dateOfBirth).slice(0, 10)
        : '';
  return `${String(params.fullName ?? '').trim().toLowerCase()}|${dob}|${String(params.gender ?? '').trim().toLowerCase()}`;
};

const hasDojahError = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return !!(value as { error?: unknown }).error;
};

export const isNinCheckSuccessful = (doc: {
  ninVerificationStatus?: string | null;
  ninVerificationResult?: { status?: string; error?: unknown } | null;
}): boolean => {
  const status = String(doc.ninVerificationStatus ?? '').toLowerCase();
  const resultStatus = String(doc.ninVerificationResult?.status ?? '').toLowerCase();
  if (doc.ninVerificationResult?.error) {
    return false;
  }
  if (status === 'failed' || resultStatus === 'failed') {
    return false;
  }
  return status === 'completed' || resultStatus === 'success' || !!doc.ninVerificationResult;
};

export const isPhoneFraudCheckSuccessful = (doc: {
  phoneFraudResult?: Record<string, unknown> | null;
}): boolean => {
  if (!doc.phoneFraudResult || hasDojahError(doc.phoneFraudResult)) {
    return false;
  }
  return true;
};

export const isCreditSummaryCheckSuccessful = (doc: {
  creditSummary?: Record<string, unknown> | null;
  creditFinancialSnapshot?: { status?: string } | null;
}): boolean => {
  if (hasDojahError(doc.creditSummary)) {
    return false;
  }
  const snap = doc.creditFinancialSnapshot as { status?: string } | null | undefined;
  if (snap?.status === 'ok' || snap?.status === 'no_hit') {
    return !!doc.creditSummary;
  }
  return !!doc.creditSummary && !hasDojahError(doc.creditSummary);
};

export const isAmlCheckSuccessful = (doc: {
  amlScreeningResult?: Record<string, unknown> | null;
}): boolean => {
  return !!doc.amlScreeningResult && !hasDojahError(doc.amlScreeningResult);
};

export const isIdDocumentCheckSuccessful = (doc: {
  identificationDocumentUrl?: string | null;
  identificationDocumentAnalysis?: Record<string, unknown> | null;
  ninVerificationResult?: unknown;
}): boolean => {
  return (
    resolveIdDocumentLandlordStatus(
      doc.identificationDocumentUrl,
      doc.identificationDocumentAnalysis,
      doc.ninVerificationResult,
    ) === 'verified'
  );
};

export const isUtilityBillCheckSuccessful = (doc: {
  utilityBillUrl?: string | null;
  utilityBillAnalysis?: { status?: string; error?: unknown } | null;
}): boolean => {
  return (
    resolveUtilityBillLandlordStatus(doc.utilityBillUrl, doc.utilityBillAnalysis) ===
    'verified'
  );
};

export type DojahCacheLookup = {
  hit: boolean;
  reason?: 'fresh' | 'missing' | 'stale' | 'input_changed' | 'not_successful' | 'disabled';
};

export const canReuseDojahCheck = (
  check: VerificationCheckKey,
  doc: {
    nin?: string | null;
    phone?: string | null;
    bvn?: string | null;
    fullName?: string | null;
    dateOfBirth?: Date | string | null;
    gender?: string | null;
    identificationDocumentUrl?: string | null;
    utilityBillUrl?: string | null;
    ninVerificationStatus?: string | null;
    ninVerificationResult?: { status?: string; error?: unknown } | null;
    ninVerificationDate?: Date | string | null;
    phoneFraudResult?: Record<string, unknown> | null;
    creditSummary?: Record<string, unknown> | null;
    creditFinancialSnapshot?: { status?: string } | null;
    amlScreeningResult?: Record<string, unknown> | null;
    identificationDocumentAnalysis?: { status?: string; error?: unknown; timestamp?: Date | string } | null;
    utilityBillAnalysis?: { status?: string; error?: unknown; timestamp?: Date | string } | null;
    dojahCheckCache?: DojahCheckCacheMap | null;
  },
  forceRefresh: boolean,
): DojahCacheLookup => {
  if (forceRefresh || getDojahCheckCacheMaxAgeMs() <= 0) {
    return { hit: false, reason: forceRefresh ? undefined : 'disabled' };
  }

  const cache = doc.dojahCheckCache ?? {};
  const entry = cache[check];

  switch (check) {
    case 'nin': {
      if (!isNinCheckSuccessful(doc)) {
        return { hit: false, reason: 'not_successful' };
      }
      const nin = doc.nin?.trim() ?? '';
      if (entry?.nin && entry.nin !== nin) {
        return { hit: false, reason: 'input_changed' };
      }
      const at = entryAt(entry, doc.ninVerificationDate);
      if (!isWithinDojahCheckCacheWindow(at)) {
        return { hit: false, reason: entry ? 'stale' : 'missing' };
      }
      return { hit: true, reason: 'fresh' };
    }
    case 'phoneFraud': {
      if (!isPhoneFraudCheckSuccessful(doc)) {
        return { hit: false, reason: 'not_successful' };
      }
      const phone = doc.phone?.trim() ? formatPhoneForDojah(doc.phone.trim()) : '';
      if (entry?.phone && entry.phone !== phone) {
        return { hit: false, reason: 'input_changed' };
      }
      const at = entryAt(entry, null);
      if (!isWithinDojahCheckCacheWindow(at)) {
        return { hit: false, reason: entry ? 'stale' : 'missing' };
      }
      return { hit: true, reason: 'fresh' };
    }
    case 'creditSummary': {
      if (!isCreditSummaryCheckSuccessful(doc)) {
        return { hit: false, reason: 'not_successful' };
      }
      const bvn = doc.bvn?.trim() ?? '';
      if (entry?.bvn && entry.bvn !== bvn) {
        return { hit: false, reason: 'input_changed' };
      }
      const legacyAt = (doc as { updatedAt?: Date | string }).updatedAt;
      const at = entryAt(entry, legacyAt);
      if (!isWithinDojahCheckCacheWindow(at)) {
        return { hit: false, reason: entry ? 'stale' : 'missing' };
      }
      return { hit: true, reason: 'fresh' };
    }
    case 'aml': {
      if (!isAmlCheckSuccessful(doc)) {
        return { hit: false, reason: 'not_successful' };
      }
      const amlInputKey = buildAmlInputKey(doc);
      if (entry?.amlInputKey && entry.amlInputKey !== amlInputKey) {
        return { hit: false, reason: 'input_changed' };
      }
      const at = entryAt(entry, null);
      if (!isWithinDojahCheckCacheWindow(at)) {
        return { hit: false, reason: entry ? 'stale' : 'missing' };
      }
      return { hit: true, reason: 'fresh' };
    }
    case 'idDocument': {
      if (!isIdDocumentCheckSuccessful(doc)) {
        return { hit: false, reason: 'not_successful' };
      }
      const documentUrl = doc.identificationDocumentUrl?.trim() ?? '';
      if (entry?.documentUrl && entry.documentUrl !== documentUrl) {
        return { hit: false, reason: 'input_changed' };
      }
      const at = entryAt(entry, doc.identificationDocumentAnalysis?.timestamp);
      if (!isWithinDojahCheckCacheWindow(at)) {
        return { hit: false, reason: entry ? 'stale' : 'missing' };
      }
      return { hit: true, reason: 'fresh' };
    }
    case 'utilityBill': {
      if (!isUtilityBillCheckSuccessful(doc)) {
        return { hit: false, reason: 'not_successful' };
      }
      const billUrl = doc.utilityBillUrl?.trim() ?? '';
      if (entry?.billUrl && entry.billUrl !== billUrl) {
        return { hit: false, reason: 'input_changed' };
      }
      const at = entryAt(entry, doc.utilityBillAnalysis?.timestamp);
      if (!isWithinDojahCheckCacheWindow(at)) {
        return { hit: false, reason: entry ? 'stale' : 'missing' };
      }
      return { hit: true, reason: 'fresh' };
    }
    default:
      return { hit: false, reason: 'missing' };
  }
};
