import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const data = await this.notificationsService.findForAdmin({
      limit: limit ? parseInt(limit, 10) : 50,
      unreadOnly: unreadOnly === 'true',
    });
    return { status: 'success', data };
  }

  @Get('unread-count')
  async unreadCount() {
    const count = await this.notificationsService.getUnreadCount();
    return { status: 'success', data: { count } };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    const notification = await this.notificationsService.markAsRead(id);
    return { status: 'success', data: notification };
  }

  @Patch('read-all')
  async markAllAsRead() {
    const result = await this.notificationsService.markAllAsRead();
    return { status: 'success', data: result };
  }
}

