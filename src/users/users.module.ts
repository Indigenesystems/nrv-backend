import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { User, UserSchema } from './entities/user.entity'; // Import User and UserSchema
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';
import { PropertiesService } from '../properties/properties.service';
import {
  LandlordAssignedTenant,
  LandlordAssignedTenantSchema,
} from 'src/properties/entities/landlord_assigned_tenant.entity';
import {
  Property,
  PropertySchema,
} from 'src/properties/entities/property.entity';
import {
  Application,
  ApplicationSchema,
} from '../properties/entities/application.entity';
import { CloudinaryService } from '../upload/cloudinary.service';
import { RoomsService } from '../rooms/rooms.service';
import { Room, RoomSchema } from '../rooms/entities/room.entity';
import {
  NotificationSettings,
  NotificationSettingsSchema,
} from './entities/notificationSettings.entity';
import {
  Maintenance,
  MaintenanceSchema,
} from '../maintenance/entities/maintenance.entity';
import {
  AgreementDocuments,
  AgreementDocumentsSchema,
} from 'src/properties/entities/agreement_documents.entity';
import { ApiProperty } from '@nestjs/swagger';
import  { UserVerification, UserVerificationSchema } from './entities/userVerification';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      {
        name: LandlordAssignedTenant.name,
        schema: LandlordAssignedTenantSchema,
      },
      { name: Property.name, schema: PropertySchema },
      { name: UserVerification.name, schema: UserVerificationSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: AgreementDocuments.name, schema: AgreementDocumentsSchema },
      { name: Room.name, schema: RoomSchema },
      { name: NotificationSettings.name, schema: NotificationSettingsSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    AuthService,
    JwtService,
    EmailService,
    PropertiesService,
    CloudinaryService,
    RoomsService,
  ],
})
export class UsersModule {}
