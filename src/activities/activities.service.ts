import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity, ActivityDocument } from './entities/activity.entity';

export interface CreateActivityDto {
  type: string;
  details: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
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
}
