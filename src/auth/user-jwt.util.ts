import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export type UserJwtPayload = {
  sub: string;
  email?: string;
  type?: string;
};

const JWT_FALLBACK_SECRET = '34ttyyuhbyh';

const getJwtSecrets = (): string[] => {
  const secrets = [process.env.JWT_SECRET, JWT_FALLBACK_SECRET].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  return Array.from(new Set(secrets));
};

export const getUserJwtPayload = (
  authHeader?: string,
): UserJwtPayload | null => {
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;
  if (!token) {
    return null;
  }
  for (const secret of getJwtSecrets()) {
    try {
      const decoded = jwt.verify(token, secret) as UserJwtPayload & {
        id?: string;
      };
      const sub = decoded?.sub || decoded?.id;
      if (!sub || decoded.type === 'staff') {
        continue;
      }
      return { sub: String(sub), email: decoded.email };
    } catch {
      // try the next known secret
    }
  }
  return null;
};

export const requireAuthenticatedUserId = (authHeader?: string): string => {
  const payload = getUserJwtPayload(authHeader);
  if (!payload?.sub) {
    throw new UnauthorizedException('Authentication required.');
  }
  return payload.sub;
};

export const assertLandlordAccountType = (accountType?: string | null) => {
  const type = String(accountType || '')
    .trim()
    .toLowerCase();
  if (type !== 'landlord' && type !== 'property owner') {
    throw new ForbiddenException(
      'Only landlord accounts can purchase verification credits.',
    );
  }
};
