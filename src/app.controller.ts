import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint
   * @returns Status and message
   */
  @Get()
  getHello(): { status: string; message: string } {
    return this.appService.getHello();
  }
}
