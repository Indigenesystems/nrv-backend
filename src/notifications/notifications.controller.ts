import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../users/users.service';
import {
  AppNotificationAccountType,
  NotificationsService,
} from './notifications.service';

type JwtPayload = { sub?: string; email?: string; type?: string };

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  private getBearerToken(req: Request): string | null {
    const h = String(req.headers?.authorization ?? '');
    if (!h.startsWith('Bearer ')) return null;
    return h.slice(7).trim() || null;
  }

  /** Staff admin hub token, or app user (tenant/landlord) token. */
  private async resolveNotificationContext(req: Request): Promise<
    | { kind: 'staff' }
    | { kind: 'app'; userId: string; accountType: AppNotificationAccountType }
  > {
    const token = this.getBearerToken(req);
    if (!token) {
      throw new UnauthorizedException('Authorization required');
    }
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(token) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload?.type === 'staff' && payload.sub) {
      return { kind: 'staff' };
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    const user = await this.userService.findUserById(String(payload.sub));
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const accountType = String((user as any).accountType || '').toLowerCase();
    if (accountType === 'tenant') {
      return { kind: 'app', userId: String((user as any)._id), accountType: 'tenant' };
    }
    if (accountType === 'landlord') {
      return { kind: 'app', userId: String((user as any)._id), accountType: 'landlord' };
    }
    throw new UnauthorizedException('Notifications are not available for this account type');
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const ctx = await this.resolveNotificationContext(req);
    const lim = limit ? parseInt(limit, 10) : 50;
    const unread = unreadOnly === 'true';
    const data =
      ctx.kind === 'staff'
        ? await this.notificationsService.findForStaffAdmin({
            limit: lim,
            unreadOnly: unread,
          })
        : await this.notificationsService.findForAppUser(ctx.userId, ctx.accountType, {
            limit: lim,
            unreadOnly: unread,
          });
    return { status: 'success', data };
  }

  @Get('unread-count')
  async unreadCount(@Req() req: Request) {
    const ctx = await this.resolveNotificationContext(req);
    const count =
      ctx.kind === 'staff'
        ? await this.notificationsService.getUnreadCountForStaffAdmin()
        : await this.notificationsService.getUnreadCountForAppUser(
            ctx.userId,
            ctx.accountType,
          );
    return { status: 'success', data: { count } };
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const ctx = await this.resolveNotificationContext(req);
    const notification =
      ctx.kind === 'staff'
        ? await this.notificationsService.markAsReadForStaffAdmin(id)
        : await this.notificationsService.markAsReadForAppUser(
            id,
            ctx.userId,
            ctx.accountType,
          );
    if (!notification) {
      return { status: 'error', message: 'Notification not found' };
    }
    return { status: 'success', data: notification };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const ctx = await this.resolveNotificationContext(req);
    const result =
      ctx.kind === 'staff'
        ? await this.notificationsService.markAllAsReadForStaffAdmin()
        : await this.notificationsService.markAllAsReadForAppUser(
            ctx.userId,
            ctx.accountType,
          );
    return { status: 'success', data: result };
  }
}
