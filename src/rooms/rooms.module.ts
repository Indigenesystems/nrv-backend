import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './entities/room.entity';
import { PropertiesService } from '../properties/properties.service';
import {
  Property,
  PropertySchema,
} from '../properties/entities/property.entity';
import { CloudinaryService } from '../upload/cloudinary.service';
import {
  Application,
  ApplicationSchema,
} from '../properties/entities/application.entity';
import { EmailService } from '../email-sender/email.service';
import {
  LandlordAssignedTenant,
  LandlordAssignedTenantSchema,
} from '../properties/entities/landlord_assigned_tenant.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import {
  Maintenance,
  MaintenanceSchema,
} from 'src/maintenance/entities/maintenance.entity';
import {
  AgreementDocuments,
  AgreementDocumentsSchema,
} from 'src/properties/entities/agreement_documents.entity';
import { ActivitiesModule } from '../activities/activities.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    ActivitiesModule,
    PlansModule,
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: AgreementDocuments.name, schema: AgreementDocumentsSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Application.name, schema: ApplicationSchema },
      {
        name: LandlordAssignedTenant.name,
        schema: LandlordAssignedTenantSchema,
      },
    ]),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, PropertiesService, CloudinaryService, EmailService],
})
export class RoomsModule {}
