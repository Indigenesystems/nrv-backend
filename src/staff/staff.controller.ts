import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { OnboardStaffDto } from './dto/onboard-staff.dto';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ---- Roles ----
  @Post('roles')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.staffService.createRole(dto);
    return { status: 'success', message: 'Role created', data: role };
  }

  @Get('roles')
  async getRoles() {
    const roles = await this.staffService.findAllRoles();
    return { status: 'success', message: 'Roles fetched', data: roles };
  }

  @Get('roles/:id')
  async getRoleById(@Param('id') id: string) {
    const role = await this.staffService.findRoleById(id);
    return { status: 'success', message: 'Role fetched', data: role };
  }

  // ---- Staff (Person) ----
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createStaff(
    @Body() dto: CreateStaffDto,
    @Query('invitedBy') invitedBy?: string,
  ) {
    const staff = await this.staffService.createStaff(dto, invitedBy);
    return { status: 'success', message: 'Staff created', data: staff };
  }

  @Get()
  async getStaff(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('onboardingStatus') onboardingStatus?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const result = await this.staffService.findAllStaff({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      roleId,
      onboardingStatus,
      sortBy,
      sortOrder,
    });
    return {
      status: 'success',
      message: 'Staff list fetched',
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  async getStaffById(@Param('id') id: string) {
    const staff = await this.staffService.findStaffById(id);
    return { status: 'success', message: 'Staff fetched', data: staff };
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    const staff = await this.staffService.updateStaff(id, dto);
    return { status: 'success', message: 'Staff updated', data: staff };
  }

  @Post(':id/onboard')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async onboardStaff(@Param('id') id: string, @Body() dto: OnboardStaffDto) {
    const staff = await this.staffService.onboardStaff(id, dto);
    return { status: 'success', message: 'Staff onboarded', data: staff };
  }

  @Delete(':id')
  async deleteStaff(@Param('id') id: string) {
    await this.staffService.deleteStaff(id);
    return { status: 'success', message: 'Staff deleted' };
  }
}
