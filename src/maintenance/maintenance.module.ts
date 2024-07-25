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
import { Property, PropertySchema } from '../properties/entities/property.entity';
import { Application, ApplicationSchema } from '../properties/entities/application.entity';

@Module({
  imports: [
    MongooseModule.forFeature([ { name: Maintenance.name, schema: MaintenanceSchema }, { name: User.name, schema: UserSchema }, { name: Room.name, schema: RoomSchema }, { name: Property.name, schema: PropertySchema },  { name: Application.name, schema: ApplicationSchema }])
  ],
  controllers: [MaintenanceController, RoomsController, UserController],
  providers: [MaintenanceService, UserService, RoomsService, CloudinaryService, JwtService, EmailService], 
})
export class MaintenanceModule {}
