import { createHash, randomBytes } from 'crypto';
import { CookieOptions } from 'express';

export const REMEMBER_ME_COOKIE = 'nrv_remember_me';
/** Persistent remember-me lifetime (30 days). */
export const REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Short-lived access JWT when remember-me is not used. */
export const ACCESS_TOKEN_SHORT_EXPIRES = '1d';
/** Access JWT when remember-me is active (still shorter than cookie). */
export const ACCESS_TOKEN_REMEMBER_EXPIRES = '7d';

export const hashRememberMeToken = (rawToken: string): string =>
  createHash('sha256').update(rawToken).digest('hex');

export const generateRememberMeRawToken = (): string =>
  randomBytes(32).toString('hex');

export const getRememberMeCookieOptions = (): CookieOptions => {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = REMEMBER_ME_TTL_MS;

  return {
    httpOnly: true,
    secure: isProd,
    // Cross-site API (frontend domain ≠ API domain) needs None+Secure in production.
    sameSite: isProd ? 'none' : 'lax',
    maxAge,
    path: '/',
  };
};

export const getClearRememberMeCookieOptions = (): CookieOptions => {
  const options = getRememberMeCookieOptions();
  delete options.maxAge;
  return {
    ...options,
    maxAge: 0,
  };
};
