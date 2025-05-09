import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { CloudinaryService } from '../upload/cloudinary.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';
import { Room, RoomSchema } from '../rooms/entities/room.entity';
import { Application, ApplicationSchema } from './entities/application.entity';
import { EmailService } from '../email-sender/email.service';
import {
  LandlordAssignedTenantSchema,
  LandlordAssignedTenant,
} from './entities/landlord_assigned_tenant.entity';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { User, UserSchema } from '../users/entities/user.entity';
import {
  Maintenance,
  MaintenanceSchema,
} from 'src/maintenance/entities/maintenance.entity';
import {
  AgreementDocuments,
  AgreementDocumentsSchema,
} from './entities/agreement_documents.entity';
import { ApiProperty } from '@nestjs/swagger';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: AgreementDocuments.name, schema: AgreementDocumentsSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Application.name, schema: ApplicationSchema },
      {
        name: LandlordAssignedTenant.name,
        schema: LandlordAssignedTenantSchema,
      },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    CloudinaryService,
    RoomsService,
    EmailService,
    CloudinaryService,
  ],
})
export class PropertiesModule {}
