import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { OnboardStaffDto } from './dto/onboard-staff.dto';
import {
  RequireStaffPermissions,
  StaffPermissionsGuard,
} from './guards/staff-permissions.guard';
import { StaffJwtGuard } from './guards/staff-jwt.guard';
import { canAssignStaffRole } from './staff-permissions';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ---- Roles ----
  @Post('roles')
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('roles.write')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.staffService.createRole(dto);
    return { status: 'success', message: 'Role created', data: role };
  }

  @Get('roles')
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('staff.read')
  async getRoles() {
    const roles = await this.staffService.findAllRoles();
    return { status: 'success', message: 'Roles fetched', data: roles };
  }

  @Get('roles/:id')
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('staff.read')
  async getRoleById(@Param('id') id: string) {
    const role = await this.staffService.findRoleById(id);
    return { status: 'success', message: 'Role fetched', data: role };
  }

  // ---- Staff (Person) ----
  @Post()
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('staff.write')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createStaff(
    @Body() dto: CreateStaffDto,
    @Query('invitedBy') invitedBy: string | undefined,
    @Req() req: { staff?: { sub: string; roleSlug?: string } },
  ) {
    const actorSlug = req.staff?.roleSlug;
    const targetRole = await this.staffService.findRoleById(dto.roleId);
    if (!targetRole) {
      throw new BadRequestException('Invalid roleId');
    }
    if (!canAssignStaffRole(actorSlug, (targetRole as any).slug)) {
      throw new ForbiddenException(
        'You cannot assign a role more privileged than your own.',
      );
    }
    const staff = await this.staffService.createStaff(
      dto,
      invitedBy || req.staff?.sub,
    );
    return { status: 'success', message: 'Staff created', data: staff };
  }

  @Get()
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('staff.read')
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
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('staff.read')
  async getStaffById(@Param('id') id: string) {
    const staff = await this.staffService.findStaffById(id);
    return { status: 'success', message: 'Staff fetched', data: staff };
  }

  @Patch(':id')
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('staff.write')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @Req() req: { staff?: { roleSlug?: string } },
  ) {
    if (dto.roleId) {
      const targetRole = await this.staffService.findRoleById(dto.roleId);
      if (!targetRole) {
        throw new BadRequestException('Invalid roleId');
      }
      if (!canAssignStaffRole(req.staff?.roleSlug, (targetRole as any).slug)) {
        throw new ForbiddenException(
          'You cannot assign a role more privileged than your own.',
        );
      }
    }
    const staff = await this.staffService.updateStaff(id, dto);
    return { status: 'success', message: 'Staff updated', data: staff };
  }

  /** Invitees set password without admin staff.write — keep public. */
  @Post(':id/onboard')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async onboardStaff(@Param('id') id: string, @Body() dto: OnboardStaffDto) {
    const staff = await this.staffService.onboardStaff(id, dto);
    return { status: 'success', message: 'Staff onboarded', data: staff };
  }

  @Delete(':id')
  @UseGuards(StaffJwtGuard, StaffPermissionsGuard)
  @RequireStaffPermissions('staff.write')
  async deleteStaff(@Param('id') id: string) {
    await this.staffService.deleteStaff(id);
    return { status: 'success', message: 'Staff deleted' };
  }
}
