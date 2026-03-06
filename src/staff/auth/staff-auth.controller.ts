import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { StaffAuthService } from './staff-auth.service';
import { LoginStaffDto } from '../dto/login-staff.dto';
import { BootstrapStaffDto } from '../dto/bootstrap-staff.dto';
import { StaffJwtGuard } from '../guards/staff-jwt.guard';

@Controller('auth/staff')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  /** One-time setup: create the first admin staff if none exist. */
  @Post('bootstrap')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async bootstrap(@Body() dto: BootstrapStaffDto) {
    const result = await this.staffAuthService.bootstrap(dto);
    return { status: 'success', message: 'Bootstrap complete', ...result };
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() dto: LoginStaffDto) {
    const result = await this.staffAuthService.login(dto);
    return { status: 'success', message: 'Login successful', ...result };
  }

  @Get('me')
  @UseGuards(StaffJwtGuard)
  async me(@Req() req: any) {
    const staffId = String(req.staff?.sub ?? '');
    const staff = await this.staffAuthService.me(staffId);
    return { status: 'success', message: 'Me fetched', data: staff };
  }
}

