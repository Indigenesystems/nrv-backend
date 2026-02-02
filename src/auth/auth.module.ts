import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/entities/user.entity';
import { EmailService } from '../email-sender/email.service';
import { PropertiesService } from '../properties/properties.service';
import { RoomsService } from '../rooms/rooms.service';
import { Room, RoomSchema } from '../rooms/entities/room.entity';
import {
  Property,
  PropertySchema,
} from 'src/properties/entities/property.entity';
import {
  Application,
  ApplicationSchema,
} from '../properties/entities/application.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import {
  LandlordAssignedTenant,
  LandlordAssignedTenantSchema,
} from '../properties/entities/landlord_assigned_tenant.entity';
import {
  NotificationSettings,
  NotificationSettingsSchema,
} from 'src/users/entities/notificationSettings.entity';
import {
  Maintenance,
  MaintenanceSchema,
} from 'src/maintenance/entities/maintenance.entity';
import {
  AgreementDocuments,
  AgreementDocumentsSchema,
} from 'src/properties/entities/agreement_documents.entity';

import { UserVerification, UserVerificationSchema } from 'src/users/entities/userVerification';
import { ActivitiesModule } from '../activities/activities.module';

@Module({
  imports: [
    ActivitiesModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: Application.name, schema: ApplicationSchema },
      {
        name: LandlordAssignedTenant.name,
        schema: LandlordAssignedTenantSchema,
      },
      { name: NotificationSettings.name, schema: NotificationSettingsSchema },
      { name: AgreementDocuments.name, schema: AgreementDocumentsSchema },
      { name: UserVerification.name, schema: UserVerificationSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    UserService,
    EmailService,
    PropertiesService,
    RoomsService,
    CloudinaryService,
  ],
})
export class AuthModule {}
