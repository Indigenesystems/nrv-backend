import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { CloudinaryService } from '../upload/cloudinary.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';
import { Room, RoomSchema } from '../rooms/entities/room.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }, { name: Room.name, schema: RoomSchema }])
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, CloudinaryService, RoomsService],
})
export class PropertiesModule {}
