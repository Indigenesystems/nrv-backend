import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Role, RoleSchema } from './entities/role.entity';
import { Staff, StaffSchema } from './entities/staff.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffAuthController } from './auth/staff-auth.controller';
import { StaffAuthService } from './auth/staff-auth.service';
import { StaffJwtGuard } from './guards/staff-jwt.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: Staff.name, schema: StaffSchema },
    ]),
    JwtModule.register({
      secret: '34ttyyuhbyh',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [StaffController, StaffAuthController],
  providers: [StaffService, StaffAuthService, StaffJwtGuard],
  exports: [StaffService],
})
export class StaffModule {}
