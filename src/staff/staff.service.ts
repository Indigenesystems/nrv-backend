import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role, RoleDocument } from './entities/role.entity';
import { Staff, StaffDocument, OnboardingStatus } from './entities/staff.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { OnboardStaffDto } from './dto/onboard-staff.dto';

@Injectable()
export class StaffService implements OnModuleInit {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
  ) {}

  private withoutPassword<T extends Record<string, any>>(obj: T): Omit<T, 'password'> {
    if (!obj) return obj as any;
    const clone = { ...(obj as any) };
    delete clone.password;
    return clone;
  }

  async onModuleInit() {
    const count = await this.roleModel.countDocuments();
    if (count === 0) {
      await this.roleModel.insertMany([
        { name: 'Admin', slug: 'admin', description: 'Full admin access' },
        { name: 'Staff', slug: 'staff', description: 'Staff member' },
        { name: 'Viewer', slug: 'viewer', description: 'Read-only access' },
      ]);
    }
  }

  // ---- Roles ----
  async createRole(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleModel.findOne({
      $or: [{ slug: dto.slug }, { name: dto.name }],
    });
    if (existing) {
      throw new BadRequestException('Role with this name or slug already exists');
    }
    const role = new this.roleModel(dto);
    return role.save();
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleModel.find().sort({ name: 1 }).exec();
  }

  async findRoleById(id: string): Promise<Role> {
    const role = await this.roleModel.findById(id).exec();
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  // ---- Staff ----
  async createStaff(dto: CreateStaffDto, invitedBy?: string): Promise<Staff> {
    const existing = await this.staffModel.findOne({ email: dto.email });
    if (existing) {
      throw new BadRequestException('Staff with this email already exists');
    }
    const role = await this.roleModel.findById(dto.roleId).exec();
    if (!role) throw new BadRequestException('Invalid role');

    const staff = new this.staffModel({
      ...dto,
      onboardingStatus: dto.onboardingStatus ?? OnboardingStatus.PENDING,
      invitedBy: invitedBy || null,
      invitedAt: invitedBy ? new Date() : undefined,
    });
    if (dto.password) {
      staff.password = await bcrypt.hash(dto.password, 10);
      staff.onboardingStatus = OnboardingStatus.ONBOARDED;
      staff.onboardedAt = new Date();
    }
    const saved = await staff.save();
    return this.withoutPassword(saved.toObject()) as any;
  }

  async findAllStaff(params: {
    page?: number;
    limit?: number;
    search?: string;
    roleId?: string;
    onboardingStatus?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: (Staff & { role?: Role })[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 10));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (params.search) {
      const searchRegex = new RegExp(params.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }
    if (params.roleId) query.roleId = params.roleId;
    if (params.onboardingStatus) query.onboardingStatus = params.onboardingStatus;

    const sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (params.sortBy) {
      sort[params.sortBy] = params.sortOrder === 'asc' ? 1 : -1;
    }

    const [data, total] = await Promise.all([
      this.staffModel
        .find(query)
        .select('-password')
        .populate('roleId', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.staffModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: data as (Staff & { role?: Role })[],
      pagination: { total, page, limit, totalPages },
    };
  }

  async findStaffById(id: string): Promise<Staff & { role?: Role }> {
    const staff = await this.staffModel
      .findById(id)
      .select('-password')
      .populate('roleId', 'name slug description')
      .lean()
      .exec();
    if (!staff) throw new NotFoundException('Staff not found');
    return staff as Staff & { role?: Role };
  }

  async updateStaff(id: string, dto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.staffModel.findById(id).exec();
    if (!staff) throw new NotFoundException('Staff not found');
    if (dto.email && dto.email !== staff.email) {
      const existing = await this.staffModel.findOne({ email: dto.email });
      if (existing) throw new BadRequestException('Email already in use');
    }
    if (dto.roleId) {
      const role = await this.roleModel.findById(dto.roleId).exec();
      if (!role) throw new BadRequestException('Invalid role');
    }
    if (dto.password) {
      (dto as Record<string, unknown>).password = await bcrypt.hash(dto.password, 10);
    }
    Object.assign(staff, dto);
    const saved = await staff.save();
    return this.withoutPassword(saved.toObject()) as any;
  }

  async onboardStaff(id: string, dto: OnboardStaffDto): Promise<Staff> {
    const staff = await this.staffModel.findById(id).exec();
    if (!staff) throw new NotFoundException('Staff not found');
    if (staff.onboardingStatus === OnboardingStatus.ONBOARDED) {
      throw new BadRequestException('Staff is already onboarded');
    }
    staff.password = await bcrypt.hash(dto.password, 10);
    staff.onboardingStatus = OnboardingStatus.ONBOARDED;
    staff.onboardedAt = new Date();
    staff.status = 'active';
    const saved = await staff.save();
    return this.withoutPassword(saved.toObject()) as any;
  }

  async deleteStaff(id: string): Promise<void> {
    const result = await this.staffModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Staff not found');
  }
}
