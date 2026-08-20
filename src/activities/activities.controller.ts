import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('admin/reports')
  async findAdminReports(
    @Res() res: Response,
    @Query('limit') limit: string = '50',
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    try {
      const limitNum = parseInt(limit, 10) || 50;
      const activities = await this.activitiesService.findFiltered({
        limit: limitNum,
        type,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      return res.status(HttpStatus.OK).json({
        status: 'success',
        data: activities.map((a: any) => ({
          type: a.type,
          details: a.details,
          userId: a.userId,
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: error?.message || 'Failed to fetch activity reports',
      });
    }
  }

  @Get('admin/detailed-reports')
  async findDetailedAdminReports(
    @Res() res: Response,
    @Query('limit') limit: string = '100',
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    try {
      const limitNum = parseInt(limit, 10) || 100;
      const data = await this.activitiesService.getDetailedAdminReport({
        limit: limitNum,
        type,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      return res.status(HttpStatus.OK).json({
        status: 'success',
        data,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: error?.message || 'Failed to fetch detailed admin reports',
      });
    }
  }

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
