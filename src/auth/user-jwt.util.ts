import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export type UserJwtPayload = {
  sub: string;
  email?: string;
  type?: string;
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
  try {
    const secret = process.env.JWT_SECRET || '34ttyyuhbyh';
    const decoded = jwt.verify(token, secret) as UserJwtPayload;
    if (!decoded?.sub || decoded.type === 'staff') {
      return null;
    }
    return { sub: String(decoded.sub), email: decoded.email };
  } catch {
    return null;
  }
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
