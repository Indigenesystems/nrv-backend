import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { UserService } from '../users/users.service';
import { RoomsService } from '../rooms/rooms.service';
import { RoomsController } from '../rooms/rooms.controller';
import { UserController } from '../users/users.controller';
import { CloudinaryService } from '../upload/cloudinary.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Maintenance, MaintenanceSchema } from './entities/maintenance.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';
import { RoomSchema, Room } from '../rooms/entities/room.entity';
import {
  Property,
  PropertySchema,
} from '../properties/entities/property.entity';
import {
  Application,
  ApplicationSchema,
} from '../properties/entities/application.entity';
import {
  LandlordAssignedTenant,
  LandlordAssignedTenantSchema,
} from '../properties/entities/landlord_assigned_tenant.entity';
import { PropertiesService } from '../properties/properties.service';
import { AuthService } from '../auth/auth.service';
import {
  NotificationSettings,
  NotificationSettingsSchema,
} from 'src/users/entities/notificationSettings.entity';
import {
  AgreementDocuments,
  AgreementDocumentsSchema,
} from 'src/properties/entities/agreement_documents.entity';
import { ApiProperty } from '@nestjs/swagger';
import { UserVerification, UserVerificationSchema } from 'src/users/entities/userVerification';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: AgreementDocuments.name, schema: AgreementDocumentsSchema },
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Application.name, schema: ApplicationSchema },
      {
        name: LandlordAssignedTenant.name,
        schema: LandlordAssignedTenantSchema,
      },
      { name: NotificationSettings.name, schema: NotificationSettingsSchema },
      { name: UserVerification.name, schema: UserVerificationSchema },
    ]),
  ],
  controllers: [MaintenanceController, RoomsController, UserController],
  providers: [
    MaintenanceService,
    UserService,
    RoomsService,
    CloudinaryService,
    JwtService,
    EmailService,
    PropertiesService,
    AuthService,
  ],
})
export class MaintenanceModule {}
