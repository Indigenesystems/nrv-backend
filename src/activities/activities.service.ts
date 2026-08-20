import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity, ActivityDocument } from './entities/activity.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Verification } from '../verification/entities/verification.entity';
import { Payment } from '../payments/entities/payment.entity';

export interface CreateActivityDto {
  type: string;
  details: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export type ActivityReportFilters = {
  limit?: number;
  type?: string;
  from?: Date;
  to?: Date;
};

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<Property>,
    @InjectModel(Verification.name)
    private readonly verificationModel: Model<Verification>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<Payment>,
  ) {}

  async create(dto: CreateActivityDto): Promise<ActivityDocument> {
    const activity = new this.activityModel({
      type: dto.type,
      details: dto.details,
      userId: dto.userId,
      metadata: dto.metadata || {},
    });
    return activity.save();
  }

  async findByUserId(
    userId: string,
    limit: number = 20,
  ): Promise<ActivityDocument[]> {
    return this.activityModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findRecent(limit: number = 50): Promise<ActivityDocument[]> {
    return this.findFiltered({ limit });
  }

  async findFiltered(filters: ActivityReportFilters = {}): Promise<ActivityDocument[]> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    const query: Record<string, unknown> = {};

    if (filters.type?.trim()) {
      query.type = filters.type.trim();
    }

    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) {
        createdAt.$gte = filters.from;
      }
      if (filters.to) {
        createdAt.$lte = filters.to;
      }
      query.createdAt = createdAt;
    }

    return this.activityModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async listActivityTypes(): Promise<string[]> {
    const types = await this.activityModel.distinct('type').exec();
    return (types || [])
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  async getDetailedAdminReport(filters: ActivityReportFilters = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const dateFilter =
      filters.from || filters.to
        ? {
            ...(filters.from ? { $gte: filters.from } : {}),
            ...(filters.to ? { $lte: filters.to } : {}),
          }
        : null;

    const createdAtMatch = dateFilter ? { createdAt: dateFilter } : {};
    const verificationDateMatch = dateFilter
      ? { $or: [{ dateRequested: dateFilter }, { createdAt: dateFilter }] }
      : {};

    const [
      activityTypes,
      activities,
      totalUsers,
      landlordCount,
      tenantCount,
      totalProperties,
      totalVerifications,
      verificationByStatus,
      pendingVerifications,
      approvedVerifications,
      rejectedVerifications,
      declinedVerifications,
      recentUsers,
      recentProperties,
      recentVerifications,
      totalPayments,
      paymentByStatus,
      successfulPayments,
      recentPayments,
    ] = await Promise.all([
      this.listActivityTypes(),
      this.findFiltered({ ...filters, limit }),
      this.userModel.countDocuments({}),
      this.userModel.countDocuments({ accountType: /landlord/i }),
      this.userModel.countDocuments({ accountType: /tenant/i }),
      this.propertyModel.countDocuments({}),
      this.verificationModel.countDocuments(verificationDateMatch),
      this.verificationModel.aggregate([
        ...(Object.keys(verificationDateMatch).length
          ? [{ $match: verificationDateMatch }]
          : []),
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.verificationModel.countDocuments({
        status: 'pending',
        ...verificationDateMatch,
      }),
      this.verificationModel.countDocuments({
        status: 'approved',
        ...verificationDateMatch,
      }),
      this.verificationModel.countDocuments({
        status: 'rejected',
        ...verificationDateMatch,
      }),
      this.verificationModel.countDocuments({
        status: 'declined',
        ...verificationDateMatch,
      }),
      this.userModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .select('firstName lastName email accountType createdAt')
        .lean()
        .exec(),
      this.propertyModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .select('propertyName streetAddress city state createdBy createdAt')
        .lean()
        .exec(),
      this.verificationModel
        .find(verificationDateMatch)
        .sort({ dateRequested: -1, createdAt: -1 })
        .limit(100)
        .select(
          'firstName lastName email status verificationTier landlordDisplayName dateRequested createdAt dateUpdated uniqueId',
        )
        .lean()
        .exec(),
      this.paymentModel.countDocuments(createdAtMatch),
      this.paymentModel.aggregate([
        ...(Object.keys(createdAtMatch).length ? [{ $match: createdAtMatch }] : []),
        { $group: { _id: '$status', count: { $sum: 1 }, totalNaira: { $sum: '$amountNaira' } } },
      ]),
      this.paymentModel
        .find({ status: 'success', ...createdAtMatch })
        .select('amountNaira')
        .lean()
        .exec(),
      this.paymentModel
        .find(createdAtMatch)
        .sort({ createdAt: -1 })
        .limit(100)
        .select('reference type amountNaira status planName paidAt createdAt userId')
        .lean()
        .exec(),
    ]);

    const statusBreakdown: Record<string, number> = {
      pending: pendingVerifications,
      approved: approvedVerifications,
      rejected: rejectedVerifications,
      declined: declinedVerifications,
    };
    for (const row of verificationByStatus || []) {
      const key = String(row?._id || 'unknown').toLowerCase();
      if (!(key in statusBreakdown)) {
        statusBreakdown[key] = Number(row.count) || 0;
      }
    }

    const paymentBreakdown: Record<string, { count: number; totalNaira: number }> = {
      pending: { count: 0, totalNaira: 0 },
      success: { count: 0, totalNaira: 0 },
      failed: { count: 0, totalNaira: 0 },
    };
    for (const row of paymentByStatus || []) {
      const key = String(row?._id || 'unknown').toLowerCase();
      paymentBreakdown[key] = {
        count: Number(row.count) || 0,
        totalNaira: Number(row.totalNaira) || 0,
      };
    }

    const successfulRevenueNaira = (successfulPayments || []).reduce(
      (sum, p: any) => sum + (Number(p.amountNaira) || 0),
      0,
    );

    const userIdSet = new Set<string>();
    for (const a of activities as any[]) {
      if (a?.userId) {
        userIdSet.add(String(a.userId));
      }
    }
    for (const p of recentProperties as any[]) {
      if (p?.createdBy) {
        userIdSet.add(String(p.createdBy));
      }
    }
    for (const p of recentPayments as any[]) {
      if (p?.userId) {
        userIdSet.add(String(p.userId));
      }
    }

    const emailByUserId = new Map<string, string>();
    if (userIdSet.size > 0) {
      const users = await this.userModel
        .find({ _id: { $in: Array.from(userIdSet) } })
        .select('email')
        .lean()
        .exec();
      for (const user of users as any[]) {
        emailByUserId.set(String(user._id), String(user.email || '').trim());
      }
    }

    const resolveEmail = (userId?: unknown) => {
      if (!userId) {
        return '';
      }
      return emailByUserId.get(String(userId)) || '';
    };

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        type: filters.type || null,
        from: filters.from?.toISOString() || null,
        to: filters.to?.toISOString() || null,
        limit,
      },
      summary: {
        totalUsers,
        landlordCount,
        tenantCount,
        totalProperties,
        totalVerifications,
        pendingVerifications,
        approvedVerifications,
        rejectedVerifications,
        declinedVerifications,
        totalPayments,
        successfulRevenueNaira,
        activityCount: activities.length,
      },
      activityTypes,
      activities: (activities as any[]).map((a) => ({
        type: a.type,
        details: a.details,
        userId: a.userId ? String(a.userId) : '',
        userEmail: resolveEmail(a.userId) || '—',
        createdAt: a.createdAt,
        metadata: a.metadata || {},
      })),
      sections: {
        users: {
          counts: {
            total: totalUsers,
            landlords: landlordCount,
            tenants: tenantCount,
          },
          recent: (recentUsers as any[]).map((u) => ({
            id: String(u._id),
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—',
            email: u.email || '—',
            accountType: u.accountType || '—',
            createdAt: u.createdAt,
          })),
        },
        properties: {
          counts: {
            total: totalProperties,
          },
          recent: (recentProperties as any[]).map((p) => ({
            id: String(p._id),
            name: p.propertyName || p.streetAddress || 'Untitled property',
            location: [p.city, p.state].filter(Boolean).join(', ') || '—',
            createdBy: p.createdBy ? String(p.createdBy) : '',
            ownerEmail: resolveEmail(p.createdBy) || '—',
            createdAt: p.createdAt,
          })),
        },
        verifications: {
          counts: statusBreakdown,
          recent: (recentVerifications as any[]).map((v) => ({
            id: String(v._id),
            uniqueId: v.uniqueId ?? null,
            tenantName: `${v.firstName || ''} ${v.lastName || ''}`.trim() || '—',
            email: v.email || '—',
            status: v.status || '—',
            tier: v.verificationTier || 'standard',
            landlordDisplayName: v.landlordDisplayName || '—',
            dateRequested: v.dateRequested || v.createdAt,
            dateUpdated: v.dateUpdated || null,
          })),
        },
        payments: {
          counts: paymentBreakdown,
          successfulRevenueNaira,
          recent: (recentPayments as any[]).map((p) => ({
            id: String(p._id),
            reference: p.reference || '—',
            type: p.type || '—',
            amountNaira: Number(p.amountNaira) || 0,
            status: p.status || '—',
            planName: p.planName || '—',
            userId: p.userId ? String(p.userId) : '',
            userEmail: resolveEmail(p.userId) || '—',
            paidAt: p.paidAt || null,
            createdAt: p.createdAt,
          })),
        },
      },
    };
  }
}
