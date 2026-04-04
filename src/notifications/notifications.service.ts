import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from './entities/notification.entity';

export type AppNotificationAccountType = 'tenant' | 'landlord';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  private adminGlobalFilter(): Record<string, unknown> {
    return {
      targetRole: 'admin',
      $or: [{ userId: null }, { userId: { $exists: false } }],
    };
  }

  async create(dto: {
    targetRole: string;
    type: string;
    title: string;
    body?: string;
    metadata?: Record<string, any>;
    userId?: string | null;
  }): Promise<Notification> {
    const doc: Record<string, unknown> = {
      targetRole: dto.targetRole,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      metadata: dto.metadata ?? {},
      read: false,
    };
    if (dto.userId) {
      doc.userId = new Types.ObjectId(dto.userId);
    }
    const created = await this.notificationModel.create(doc);
    return created.toObject ? (created.toObject() as Notification) : (created as any);
  }

  async findForStaffAdmin(options: {
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<any[]> {
    const { limit = 50, unreadOnly = false } = options;
    const query: Record<string, unknown> = { ...this.adminGlobalFilter() };
    if (unreadOnly) query.read = false;
    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getUnreadCountForStaffAdmin(): Promise<number> {
    return this.notificationModel.countDocuments({
      ...this.adminGlobalFilter(),
      read: false,
    });
  }

  async findForAppUser(
    userId: string,
    accountType: AppNotificationAccountType,
    options: { limit?: number; unreadOnly?: boolean } = {},
  ): Promise<any[]> {
    const { limit = 50, unreadOnly = false } = options;
    const targetRole = accountType === 'tenant' ? 'tenant' : 'landlord';
    const query: Record<string, unknown> = {
      targetRole,
      userId: new Types.ObjectId(userId),
    };
    if (unreadOnly) query.read = false;
    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getUnreadCountForAppUser(
    userId: string,
    accountType: AppNotificationAccountType,
  ): Promise<number> {
    const targetRole = accountType === 'tenant' ? 'tenant' : 'landlord';
    return this.notificationModel.countDocuments({
      targetRole,
      userId: new Types.ObjectId(userId),
      read: false,
    });
  }

  async markAsReadForStaffAdmin(id: string): Promise<any | null> {
    const n = await this.notificationModel.findById(id).lean();
    if (!n) return null;
    if (n.targetRole !== 'admin' || n.userId) return null;
    return this.notificationModel
      .findByIdAndUpdate(id, { read: true, readAt: new Date() }, { new: true })
      .lean();
  }

  async markAsReadForAppUser(
    id: string,
    userId: string,
    accountType: AppNotificationAccountType,
  ): Promise<any | null> {
    const targetRole = accountType === 'tenant' ? 'tenant' : 'landlord';
    const n = await this.notificationModel.findById(id).lean();
    if (!n) return null;
    if (n.targetRole !== targetRole || String(n.userId) !== userId) return null;
    return this.notificationModel
      .findByIdAndUpdate(id, { read: true, readAt: new Date() }, { new: true })
      .lean();
  }

  async markAllAsReadForStaffAdmin(): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { ...this.adminGlobalFilter(), read: false },
      { read: true, readAt: new Date() },
    );
    return { modifiedCount: (result as any).modifiedCount ?? 0 };
  }

  async markAllAsReadForAppUser(
    userId: string,
    accountType: AppNotificationAccountType,
  ): Promise<{ modifiedCount: number }> {
    const targetRole = accountType === 'tenant' ? 'tenant' : 'landlord';
    const result = await this.notificationModel.updateMany(
      {
        targetRole,
        userId: new Types.ObjectId(userId),
        read: false,
      },
      { read: true, readAt: new Date() },
    );
    return { modifiedCount: (result as any).modifiedCount ?? 0 };
  }

  /** @deprecated use scoped methods; kept for backwards compatibility */
  async findForAdmin(options: {
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<any[]> {
    return this.findForStaffAdmin(options);
  }

  /** @deprecated */
  async getUnreadCount(): Promise<number> {
    return this.getUnreadCountForStaffAdmin();
  }

  /** @deprecated */
  async markAsRead(id: string): Promise<any> {
    return this.markAsReadForStaffAdmin(id);
  }

  /** @deprecated */
  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    return this.markAllAsReadForStaffAdmin();
  }

  async hasAdminNotificationForResponse(
    type: string,
    verificationResponseId: string,
  ): Promise<boolean> {
    const n = await this.notificationModel
      .findOne({
        type,
        targetRole: 'admin',
        'metadata.verificationResponseId': verificationResponseId,
      })
      .select('_id')
      .lean();
    return !!n;
  }

  async hasLandlordCompletionNotification(verificationResponseId: string): Promise<boolean> {
    const n = await this.notificationModel
      .findOne({
        type: 'verification_complete',
        targetRole: 'landlord',
        'metadata.verificationResponseId': verificationResponseId,
      })
      .select('_id')
      .lean();
    return !!n;
  }
}
