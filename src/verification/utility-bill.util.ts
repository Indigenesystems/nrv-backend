/** Dojah utility-bill endpoint expects a fetchable image URL (not raw PDF). */
export const toDojahUtilityBillImageUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes('cloudinary.com')) {
      return trimmed;
    }
    if (parsed.pathname.includes('/raw/upload/')) {
      parsed.pathname = parsed.pathname.replace('/raw/upload/', '/image/upload/pg_1,f_jpg/');
    }
    if (/\.pdf$/i.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\.pdf$/i, '.jpg');
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
};

export type LandlordAutomatedCheckStatus =
  | 'verified'
  | 'valid'
  | 'failed'
  | 'invalid'
  | 'not_run'
  | 'not_provided';

export const resolveUtilityBillLandlordStatus = (
  utilityBillUrl: string | undefined | null,
  analysis: Record<string, unknown> | null | undefined,
): 'verified' | 'failed' | 'not_run' | 'not_provided' => {
  if (!utilityBillUrl?.trim()) {
    return 'not_provided';
  }
  if (!analysis) {
    return 'not_run';
  }
  if (String(analysis.status ?? '').toLowerCase() === 'failed' || analysis.error) {
    return 'failed';
  }
  const entity = analysis.entity as Record<string, unknown> | undefined;
  const result = entity?.result as { status?: string; message?: string } | undefined;
  const resultStatus = String(result?.status ?? '').toLowerCase();
  if (resultStatus === 'failed' || resultStatus === 'error') {
    return 'failed';
  }
  if (
    resultStatus === 'success' ||
    resultStatus === 'successful' ||
    entity?.address_info ||
    entity?.identity_info
  ) {
    return 'verified';
  }
  if (entity && !analysis.error) {
    return 'verified';
  }
  return 'failed';
};
