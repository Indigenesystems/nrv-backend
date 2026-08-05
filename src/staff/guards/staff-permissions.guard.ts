import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  StaffPermission,
  staffHasPermission,
} from '../staff-permissions';

export const STAFF_PERMISSIONS_KEY = 'staff_permissions';
export const RequireStaffPermissions = (...permissions: StaffPermission[]) =>
  SetMetadata(STAFF_PERMISSIONS_KEY, permissions);

type StaffJwtPayload = {
  sub: string;
  email: string;
  type: 'staff';
  roleSlug?: string;
};

/**
 * Requires a valid staff JWT and (optionally) one of the listed permissions.
 * Apply after/with routes that are admin-hub only.
 */
@Injectable()
export class StaffPermissionsGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = String(req.headers?.authorization ?? '');
    const [, token] = authHeader.split(' ');
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    let payload: StaffJwtPayload;
    try {
      payload = this.jwtService.verify(token) as StaffJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload || payload.type !== 'staff' || !payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }
    req.staff = payload;

    const required =
      this.reflector.getAllAndOverride<StaffPermission[]>(STAFF_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (required.length === 0) {
      return true;
    }

    const allowed = required.some((perm) =>
      staffHasPermission(payload.roleSlug, perm),
    );
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }
    return true;
  }
}

/** Parse staff JWT if present; return null when missing/invalid/non-staff. */
export const tryParseStaffJwt = (
  jwtService: JwtService,
  authorization?: string,
): StaffJwtPayload | null => {
  const authHeader = String(authorization ?? '');
  const [, token] = authHeader.split(' ');
  if (!token) {
    return null;
  }
  try {
    const payload = jwtService.verify(token) as StaffJwtPayload;
    if (!payload || payload.type !== 'staff' || !payload.sub) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};
