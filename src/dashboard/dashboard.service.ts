import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivitiesService } from '../activities/activities.service';
import { Expense } from '../expenses/entities/expense.entity';
import {
  Application,
  ApplicationStatus,
} from '../properties/entities/application.entity';
import { LandlordAssignedTenant } from '../properties/entities/landlord_assigned_tenant.entity';
import { Property } from '../properties/entities/property.entity';
import { Room } from '../rooms/entities/room.entity';

export interface MonthlyFinancialData {
  month: string;
  income: number;
  expenses: number;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

type LeanLease = {
  propertyId?: Types.ObjectId | string | { _id?: Types.ObjectId | string };
  rentStartDate?: Date | null;
  rentEndDate?: Date | null;
  status?: ApplicationStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly activitiesService: ActivitiesService,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
    @InjectModel(LandlordAssignedTenant.name)
    private readonly landlordAssignedTenantModel: Model<LandlordAssignedTenant>,
  ) {}

  async getActivities(userId: string, limit: number = 20) {
    return this.activitiesService.findByUserId(userId, limit);
  }

  private getNormalizedMonthlyRentForRoom(room: {
    rentAmount?: number;
    rentAmountMetrics?: string;
  }): number {
    const rentAmount = Number(room?.rentAmount ?? 0);
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      return 0;
    }

    const metricsRaw = String(room?.rentAmountMetrics ?? '').toLowerCase();
    const isYearly =
      metricsRaw.includes('year') ||
      metricsRaw.includes('/yr') ||
      metricsRaw.includes('per year') ||
      metricsRaw.includes('ann');
    const isMonthly =
      metricsRaw.includes('month') ||
      metricsRaw.includes('/mo') ||
      metricsRaw.includes('per month');

    if (isYearly && !isMonthly) {
      return Math.round(rentAmount / 12);
    }

    return Math.round(rentAmount);
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private endOfDay(d: Date): Date {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      23,
      59,
      59,
      999,
    );
  }

  private rangesOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date,
  ): boolean {
    return startA.getTime() <= endB.getTime() && startB.getTime() <= endA.getTime();
  }

  private getBoundsForCalendarMonthKey(key: string): {
    monthStart: Date;
    monthEnd: Date;
  } {
    const [yStr, mStr] = key.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { monthStart, monthEnd };
  }

  /** Resolve [leaseStart, leaseEnd] inclusive days for overlap with calendar months. */
  private getRoomIdFromLeasePropertyId(propertyId: unknown): string | null {
    if (propertyId == null) {
      return null;
    }
    if (typeof propertyId === 'object' && '_id' in (propertyId as object)) {
      const id = (propertyId as { _id: unknown })._id;
      if (id != null) {
        return String(id);
      }
    }
    return String(propertyId);
  }

  private getLeaseInterval(
    doc: LeanLease,
    now: Date,
  ): { leaseStart: Date; leaseEnd: Date } | null {
    const createdAt = doc.createdAt ? new Date(doc.createdAt) : null;
    const rawStart = doc.rentStartDate
      ? new Date(doc.rentStartDate)
      : createdAt;
    if (!rawStart || Number.isNaN(rawStart.getTime())) {
      return null;
    }

    const leaseStart = this.startOfDay(rawStart);

    if (doc.rentEndDate) {
      const leaseEnd = this.endOfDay(new Date(doc.rentEndDate));
      if (leaseEnd.getTime() < leaseStart.getTime()) {
        return null;
      }
      return { leaseStart, leaseEnd };
    }

    if (doc.status === ApplicationStatus.ACTIVE_LEASE) {
      return { leaseStart, leaseEnd: this.endOfDay(now) };
    }

    const fallbackEnd = doc.updatedAt
      ? new Date(doc.updatedAt)
      : createdAt ?? now;
    return { leaseStart, leaseEnd: this.endOfDay(fallbackEnd) };
  }

  async getFinancialData(userId: string): Promise<MonthlyFinancialData[]> {
    const properties = await this.propertyModel
      .find({ createdBy: userId })
      .select('_id')
      .lean();
    const propertyIds = properties.map((p) => p._id);

    const rooms = await this.roomModel
      .find({ propertyId: { $in: propertyIds } })
      .select('_id rentAmount rentAmountMetrics assignedToTenant')
      .lean();
    const roomIds = rooms.map((r) => r._id);

    const roomMonthlyRentById = new Map<string, number>();
    for (const r of rooms as any[]) {
      const id = r?._id?.toString?.();
      if (!id) {
        continue;
      }
      roomMonthlyRentById.set(id, this.getNormalizedMonthlyRentForRoom(r));
    }

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const ownerOid = new Types.ObjectId(userId);
    const leaseStatuses = [
      ApplicationStatus.ACTIVE_LEASE,
      ApplicationStatus.ENDED,
    ];

    const [expenses, applications, assignments] = await Promise.all([
      this.expenseModel
        .find({
          roomId: { $in: roomIds },
          createdAt: { $gte: twelveMonthsAgo },
        })
        .select('amount createdAt')
        .lean(),
      this.applicationModel
        .find({
          ownerId: ownerOid,
          status: { $in: leaseStatuses },
        })
        .select(
          'propertyId rentStartDate rentEndDate status createdAt updatedAt',
        )
        .lean(),
      this.landlordAssignedTenantModel
        .find({
          ownerId: ownerOid,
          status: { $in: leaseStatuses },
        })
        .select(
          'propertyId rentStartDate rentEndDate status createdAt updatedAt',
        )
        .lean(),
    ]);

    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, { income: 0, expenses: 0 });
    }

    const addIncomeForMonthKey = (key: string, amount: number) => {
      if (!monthlyMap.has(key) || amount <= 0) {
        return;
      }
      const entry = monthlyMap.get(key)!;
      entry.income += amount;
    };

    const leaseDocs: LeanLease[] = [
      ...(applications as unknown as LeanLease[]),
      ...(assignments as unknown as LeanLease[]),
    ];

    for (const doc of leaseDocs) {
      const roomId = this.getRoomIdFromLeasePropertyId(doc.propertyId);
      if (!roomId || !roomMonthlyRentById.has(roomId)) {
        continue;
      }

      const monthlyRent = roomMonthlyRentById.get(roomId)!;
      if (monthlyRent <= 0) {
        continue;
      }

      const interval = this.getLeaseInterval(doc, now);
      if (!interval) {
        continue;
      }

      const { leaseStart, leaseEnd } = interval;

      for (const key of monthlyMap.keys()) {
        const { monthStart, monthEnd } = this.getBoundsForCalendarMonthKey(key);
        if (this.rangesOverlap(leaseStart, leaseEnd, monthStart, monthEnd)) {
          addIncomeForMonthKey(key, monthlyRent);
        }
      }
    }

    for (const exp of expenses) {
      const createdAt = (exp as any).createdAt as Date;
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(key)) {
        const entry = monthlyMap.get(key)!;
        entry.expenses += exp.amount || 0;
      }
    }

    return Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => {
        const [, month] = key.split('-');
        const monthIndex = parseInt(month, 10) - 1;
        return {
          month: MONTH_LABELS[monthIndex],
          income: Math.round(data.income),
          expenses: Math.round(data.expenses),
        };
      });
  }

  async getDashboardData(userId: string, activitiesLimit: number = 20) {
    const [activities, financialData] = await Promise.all([
      this.getActivities(userId, activitiesLimit),
      this.getFinancialData(userId),
    ]);

    return {
      activities: activities.map((a: any) => ({
        type: a.type,
        details: a.details,
        createdAt: a.createdAt,
      })),
      financialData,
    };
  }
}
