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
import { LandlordAssignedTenantSchema, LandlordAssignedTenant } from './entities/landlord_assigned_tenant.entity';
import { MaintenanceService } from '../maintenance/maintenance.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }, { name: Room.name, schema: RoomSchema }, { name: Application.name, schema: ApplicationSchema }, { name: LandlordAssignedTenant.name, schema: LandlordAssignedTenantSchema }])
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, CloudinaryService, RoomsService, EmailService],
})
export class PropertiesModule {}
