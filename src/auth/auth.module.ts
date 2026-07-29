import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserService } from '../users/users.service';
import { JwtModule } from '@nestjs/jwt';
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
} from '../properties/entities/agreement_documents.entity';

import { UserVerification, UserVerificationSchema } from 'src/users/entities/userVerification';
import { ActivitiesModule } from '../activities/activities.module';
import { PlansModule } from '../plans/plans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  RememberMeToken,
  RememberMeTokenSchema,
} from './entities/remember-me-token.entity';

@Module({
  imports: [
    ActivitiesModule,
    PlansModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || '34ttyyuhbyh',
      signOptions: { expiresIn: '1d' },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Application.name, schema: ApplicationSchema },
      {
        name: LandlordAssignedTenant.name,
        schema: LandlordAssignedTenantSchema,
      },
      { name: NotificationSettings.name, schema: NotificationSettingsSchema },
      { name: AgreementDocuments.name, schema: AgreementDocumentsSchema },
      { name: UserVerification.name, schema: UserVerificationSchema },
      { name: RememberMeToken.name, schema: RememberMeTokenSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserService,
    EmailService,
    PropertiesService,
    RoomsService,
    CloudinaryService,
  ],
  exports: [AuthService, MongooseModule],
})
export class AuthModule {}
