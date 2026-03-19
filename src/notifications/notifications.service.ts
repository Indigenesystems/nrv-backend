import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async create(dto: {
    targetRole: string;
    type: string;
    title: string;
    body?: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    const created = await this.notificationModel.create({
      targetRole: dto.targetRole,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      metadata: dto.metadata,
      read: false,
    });
    return created.toObject ? (created.toObject() as Notification) : (created as any);
  }

  async findForAdmin(options: {
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<any[]> {
    const { limit = 50, unreadOnly = false } = options;
    const query: any = { targetRole: 'admin' };
    if (unreadOnly) query.read = false;
    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getUnreadCount(): Promise<number> {
    return this.notificationModel.countDocuments({
      targetRole: 'admin',
      read: false,
    });
  }

  async markAsRead(id: string): Promise<any> {
    return this.notificationModel
      .findByIdAndUpdate(
        id,
        { read: true, readAt: new Date() },
        { new: true },
      )
      .lean();
  }

  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { targetRole: 'admin', read: false },
      { read: true, readAt: new Date() },
    );
    return { modifiedCount: (result as any).modifiedCount ?? 0 };
  }
}

