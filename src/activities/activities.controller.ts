import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  async findAll(
    @Query('userId') userId: string,
    @Query('limit') limit: string = '20',
    @Res() res: Response,
  ) {
    if (!userId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: 'userId is required',
      });
    }

    try {
      const limitNum = parseInt(limit, 10) || 20;
      const activities = await this.activitiesService.findByUserId(
        userId,
        limitNum,
      );

      return res.status(HttpStatus.OK).json({
        status: 'success',
        data: activities.map((a) => ({
          type: a.type,
          details: a.details,
          createdAt: (a as any).createdAt,
        })),
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: error?.message || 'Failed to fetch activities',
      });
    }
  }
}
