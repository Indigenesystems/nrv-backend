import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './entities/room.entity';
import { PropertiesService } from '../properties/properties.service';
import { Property, PropertySchema } from '../properties/entities/property.entity';
import { CloudinaryService } from '../upload/cloudinary.service';
import { Application, ApplicationSchema } from '../properties/entities/application.entity';
import { EmailService } from '../email-sender/email.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Room.name, schema: RoomSchema }, { name: Property.name, schema: PropertySchema }, { name: Application.name, schema: ApplicationSchema }]),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, PropertiesService, CloudinaryService, EmailService],
})
export class RoomsModule {}
