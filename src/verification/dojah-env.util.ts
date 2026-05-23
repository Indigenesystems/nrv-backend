/**
 * Dojah environment helpers.
 * When NODE_ENV=production, defaults to production API and real identifiers
 * unless explicitly overridden via DOJAH_SANDBOX / DOJAH_USE_TEST_IDENTIFIERS.
 */
export const isProductionRuntime = (): boolean =>
  process.env.NODE_ENV === 'production';

export const useDojahSandbox = (): boolean => {
  const flag = process.env.DOJAH_SANDBOX?.trim().toLowerCase();
  if (flag === 'false') {
    return false;
  }
  if (flag === 'true') {
    return true;
  }
  return !isProductionRuntime();
};

export const useDojahTestIdentifiers = (): boolean => {
  const flag = process.env.DOJAH_USE_TEST_IDENTIFIERS?.trim().toLowerCase();
  if (flag === 'false') {
    return false;
  }
  if (flag === 'true') {
    return true;
  }
  return !isProductionRuntime();
};

export const getDojahApiBase = (): string =>
  useDojahSandbox() ? 'https://sandbox.dojah.io' : 'https://api.dojah.io';

export const getDojahTestNin = (): string => {
  const envTestNin = process.env.DOJAH_TEST_NIN?.trim();
  if (envTestNin && /^\d{11}$/.test(envTestNin)) {
    return envTestNin;
  }
  return '70123456789';
};

export const getDojahTestPhone = (): string => {
  const envTestPhone = process.env.DOJAH_TEST_PHONE?.trim();
  if (envTestPhone) {
    return envTestPhone;
  }
  return '09011111111';
};

/** Nigeria E.164 without '+' — Dojah expects country code 234 (not local 0…). */
export const formatPhoneForDojah = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return phone.trim();
  }
  if (digits.startsWith('234')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `234${digits.slice(1)}`;
  }
  return `234${digits}`;
};

/** Reuse stored Dojah check results when younger than this many days (default 7). Set 0 to disable. */
export { getDojahCheckCacheDays } from './dojah-check-cache.util';
