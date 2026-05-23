import { Logger } from '@nestjs/common';

const logger = new Logger('Dojah');

const MAX_PLAIN_STRING_LEN = 220;
/** Keys whose string values are almost always image/base64 payloads from Dojah. */
const BINARY_VALUE_KEY_RE =
  /^(portrait|signature|photo|selfie|liveness|imagefrontside|imagebackside|images|image|raw|data)$/i;

/** Last N digits only — avoid logging full NIN/BVN/phone in production logs. */
export function maskDigits(value: string | undefined | null, keepFromEnd = 4): string {
  if (value == null || value === '') return '(empty)';
  const s = String(value).replace(/\s+/g, '');
  if (s.length <= keepFromEnd) return '***';
  return `***${s.slice(-keepFromEnd)}`;
}

function looksLikeBase64OrDataUrl(s: string): boolean {
  const t = s.trim();
  if (t.length < 64) return false;
  if (/^data:image\//i.test(t)) return true;
  if (t.startsWith('/9j/')) return true;
  const compact = t.replace(/\s+/g, '');
  if (compact.length < 80) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(compact);
}

export function redactStringForLog(s: string): string {
  if (looksLikeBase64OrDataUrl(s) || s.length > MAX_PLAIN_STRING_LEN) {
    return `[redacted len=${s.length}]`;
  }
  return s;
}

/** Deep-clone-ish redaction for JSON logging: strips base64 and oversized strings. */
export function redactDeepForLog(value: unknown, depth = 0): unknown {
  if (depth > 14) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'string') return redactStringForLog(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactDeepForLog(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && BINARY_VALUE_KEY_RE.test(k)) {
      out[k] = redactStringForLog(v);
      continue;
    }
    out[k] = redactDeepForLog(v, depth + 1);
  }
  return out;
}

/**
 * Structured fields from Dojah document analysis (ID) — matches typical `entity` payload
 * without embedding portrait/base64 in logs.
 */
export function identificationDocumentAnalysisOutcome(analysis: unknown): Record<string, unknown> {
  const a = analysis as Record<string, any> | null | undefined;
  const entity = a?.entity ?? a;
  const status = entity?.status;
  const docType = entity?.document_type;
  const docImages = entity?.document_images;
  const imageFieldSummary: Record<string, string> = {};
  if (docImages && typeof docImages === 'object') {
    for (const [k, v] of Object.entries(docImages)) {
      if (typeof v === 'string') {
        imageFieldSummary[k] =
          v.length > 80 ? `[image base64 present, len=${v.length}]` : redactStringForLog(v);
      } else {
        imageFieldSummary[k] = String(v);
      }
    }
  }
  const idNin = a?.idNinAlignment as Record<string, unknown> | undefined;
  return {
    overall_status: status?.overall_status,
    reason: status?.reason,
    checks: status
      ? {
          document_images: status.document_images,
          text: status.text,
          document_type: status.document_type,
          expiry: status.expiry,
        }
      : undefined,
    document_name: docType?.document_name,
    document_country_name: docType?.document_country_name,
    document_country_code: docType?.document_country_code,
    document_image_fields: Object.keys(imageFieldSummary).length ? imageFieldSummary : undefined,
    authentic: idNin?.authentic,
    nin_name_match: idNin?.namesMatch,
    nin_dob_match: idNin?.dobMatch,
    extracted_name: idNin?.extractedFullName
      ? '[present]'
      : undefined,
    mismatch_reason: idNin?.mismatchReason,
  };
}

/** Structured utility-bill extraction — aligns with Dojah `entity` shape in logs. */
export function utilityBillAnalysisOutcome(analysis: unknown): Record<string, unknown> {
  const a = analysis as Record<string, any> | null | undefined;
  const e = a?.entity ?? a;
  const r = e?.result;
  const addr = e?.address_info;
  return {
    result_status: r?.status,
    result_message: r?.message,
    identity_full_name: e?.identity_info?.full_name,
    meter_number: e?.identity_info?.meter_number,
    address: addr
      ? {
          street: addr.street,
          city: addr.city,
          state: addr.state,
          country: addr.country,
        }
      : undefined,
    provider_name: e?.provider_name,
    bill_issue_date: e?.bill_issue_date,
    amount_paid: e?.amount_paid,
    is_recent: e?.metadata?.is_recent,
    extraction_date: e?.metadata?.extraction_date,
  };
}

export function summarizeForLog(data: unknown, maxLen = 800): string {
  if (data == null) return 'null';
  if (typeof data === 'string') {
    const r = redactStringForLog(data);
    return r.length > maxLen ? `${r.slice(0, maxLen)}…(truncated)` : r;
  }
  if (typeof data !== 'object') return String(data);
  try {
    const s = JSON.stringify(redactDeepForLog(data));
    return s.length > maxLen ? `${s.slice(0, maxLen)}…(truncated)` : s;
  } catch {
    return '[unserializable]';
  }
}

export function summarizeError(err: unknown, maxLen = 500): string {
  const e = err as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const status = e?.response?.status;
  const body = summarizeForLog(e?.response?.data ?? e?.message ?? err, maxLen);
  return `status=${status ?? 'n/a'} ${body}`;
}

export function logDojahRequest(operation: string, meta: Record<string, unknown>): void {
  logger.log(`[request] ${operation} ${JSON.stringify(meta)}`);
}

export function logDojahResponse(
  operation: string,
  ms: number,
  ok: boolean,
  detail: string,
): void {
  logger.log(`[response] ${operation} ok=${ok} ms=${ms} ${detail}`);
}

export function logDojahDbUpdate(operation: string, meta: Record<string, unknown>): void {
  logger.log(`[db_update] ${operation} ${JSON.stringify(meta)}`);
}
