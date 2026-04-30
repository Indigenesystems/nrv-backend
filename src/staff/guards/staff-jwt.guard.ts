import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

type StaffJwtPayload = {
  sub: string;
  email: string;
  type: 'staff';
  roleSlug?: string;
};

@Injectable()
export class StaffJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = String(req.headers?.authorization ?? '');
    const [, token] = authHeader.split(' ');
    if (!token) throw new UnauthorizedException('Missing Bearer token');

    try {
      const payload = this.jwtService.verify(token) as StaffJwtPayload;
      if (!payload || payload.type !== 'staff' || !payload.sub) {
        throw new UnauthorizedException('Invalid token');
      }
      req.staff = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

