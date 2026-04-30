import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(
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
      const data = await this.dashboardService.getDashboardData(userId, limitNum);

      return res.status(HttpStatus.OK).json({
        status: 'success',
        data,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: error?.message || 'Failed to fetch dashboard data',
      });
    }
  }
}
