import { Controller, Get, Param } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async getAll() {
    return this.plansService.getAll();
  }

  @Get('default')
  async getDefault() {
    return this.plansService.getDefaultPlan();
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const plan = await this.plansService.findBySlug(slug);
    if (!plan) return { data: null, message: 'Plan not found' };
    return { data: plan };
  }
}
