import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Staff, StaffDocument, OnboardingStatus } from '../entities/staff.entity';
import { Role, RoleDocument } from '../entities/role.entity';
import { LoginStaffDto } from '../dto/login-staff.dto';
import { BootstrapStaffDto } from '../dto/bootstrap-staff.dto';

function safeStaff(staff: any) {
  if (!staff) return null;
  const { password, ...rest } = staff;
  return rest;
}

@Injectable()
export class StaffAuthService {
  constructor(
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async bootstrap(dto: BootstrapStaffDto) {
    const existingCount = await this.staffModel.countDocuments();
    if (existingCount > 0) {
      throw new ForbiddenException('Bootstrap is disabled once staff exist.');
    }

    const adminRole =
      (await this.roleModel.findOne({ slug: 'admin' }).exec()) ||
      (await new this.roleModel({
        name: 'Admin',
        slug: 'admin',
        description: 'Full admin access',
      }).save());

    const hashed = await bcrypt.hash(dto.password, 10);
    const staff = await new this.staffModel({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      roleId: adminRole._id,
      password: hashed,
      onboardingStatus: OnboardingStatus.ONBOARDED,
      onboardedAt: new Date(),
      status: 'active',
    }).save();

    const accessToken = this.jwtService.sign({
      sub: String(staff._id),
      email: staff.email,
      type: 'staff',
      roleSlug: 'admin',
    });

    return { staff: safeStaff(staff.toObject()), accessToken };
  }

  async login(dto: LoginStaffDto) {
    const email = dto.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required');

    const staff = await this.staffModel
      .findOne({ email })
      .populate('roleId', 'slug name')
      .exec();

    if (!staff || !staff.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (staff.onboardingStatus !== OnboardingStatus.ONBOARDED) {
      throw new ForbiddenException('Staff has not been onboarded yet');
    }

    const ok = await bcrypt.compare(dto.password, staff.password);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    staff.lastLoginAt = new Date();
    await staff.save();

    const roleSlug =
      typeof (staff as any).roleId === 'object' ? (staff as any).roleId?.slug : undefined;

    const accessToken = this.jwtService.sign({
      sub: String(staff._id),
      email: staff.email,
      type: 'staff',
      roleSlug,
    });

    return { staff: safeStaff(staff.toObject()), accessToken };
  }

  async me(staffId: string) {
    const staff = await this.staffModel
      .findById(staffId)
      .populate('roleId', 'slug name description')
      .lean()
      .exec();
    if (!staff) throw new UnauthorizedException('Invalid token');
    return safeStaff(staff);
  }
}

