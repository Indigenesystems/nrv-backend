import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivitiesService } from '../activities/activities.service';
import { Expense } from '../expenses/entities/expense.entity';
import { Property } from '../properties/entities/property.entity';
import { Room } from '../rooms/entities/room.entity';

export interface MonthlyFinancialData {
  month: string;
  income: number;
  expenses: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class DashboardService {
  constructor(
    private readonly activitiesService: ActivitiesService,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
  ) {}

  async getActivities(userId: string, limit: number = 20) {
    return this.activitiesService.findByUserId(userId, limit);
  }

  async getFinancialData(userId: string): Promise<MonthlyFinancialData[]> {
    // Get landlord's property IDs
    const properties = await this.propertyModel
      .find({ createdBy: userId })
      .select('_id')
      .lean();
    const propertyIds = properties.map((p) => p._id);

    // Get room IDs belonging to these properties
    const rooms = await this.roomModel
      .find({ propertyId: { $in: propertyIds } })
      .select('_id')
      .lean();
    const roomIds = rooms.map((r) => r._id);

    // Aggregate expenses by month for the last 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const expenses = await this.expenseModel
      .find({
        roomId: { $in: roomIds },
        createdAt: { $gte: twelveMonthsAgo },
      })
      .select('amount createdAt')
      .lean();

    // Build monthly aggregates
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, {
        income: 0,
        expenses: 0,
      });
    }

    for (const exp of expenses) {
      const createdAt = (exp as any).createdAt as Date;
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(key)) {
        const entry = monthlyMap.get(key)!;
        entry.expenses += exp.amount || 0;
      }
    }

    // Convert to array in chronological order
    return Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => {
        const [year, month] = key.split('-');
        const monthIndex = parseInt(month, 10) - 1;
        return {
          month: MONTH_LABELS[monthIndex],
          income: data.income,
          expenses: data.expenses,
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
