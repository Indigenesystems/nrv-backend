import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './entities/room.entity';
import { PropertiesService } from '../properties/properties.service';
import { Property, PropertySchema } from '../properties/entities/property.entity';
import { CloudinaryService } from '../upload/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Room.name, schema: RoomSchema }, { name: Property.name, schema: PropertySchema }]),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, PropertiesService, CloudinaryService],
})
export class RoomsModule {}
