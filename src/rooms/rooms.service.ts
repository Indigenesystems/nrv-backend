import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room } from './entities/room.entity';
import { CreateRoomDTO } from './dto/create-room.dto';
import { PropertiesService } from '../properties/properties.service';
import { Property } from '../properties/entities/property.entity';
import { Application } from '../properties/entities/application.entity';

@Injectable()
export class RoomsService {

    constructor(
        @InjectModel(Room.name) private readonly roomModel: Model<Room>,
        @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
        @InjectModel(Application.name) private readonly applicationModel: Model<Application>,
        // private propertiesService: PropertiesService

    ) { }

    async createRooms(createRoomDTOs: CreateRoomDTO[]) {
        const latestRoom = await this.roomModel.findOne({}, { roomId: 1 }).sort({ roomId: -1 }).limit(1);
        const maxRoomId = latestRoom ? latestRoom.roomId : 0;

        const rooms = createRoomDTOs.map((createRoomDTO, index) => {
            const { name, description, propertyId, targetDeposit, targetRent } = createRoomDTO;
            const roomId = maxRoomId + index + 1;
            return {
                name,
                description,
                propertyId,
                targetDeposit,
                targetRent,
                roomId
            };
        });

        try {
            const newRooms = await this.roomModel.create(rooms);
            return newRooms;
        } catch (error) {
            throw new Error(`Failed to create rooms: ${error.message}`);
        }
    }

    async roomByPropertyId(id: any): Promise<any> {
        return await this.roomModel.find({ propertyId: id });
    }

    async deleteRoomByPropertyId(id: any) {
        const deletedRoom: any = await this.roomModel.deleteMany({ propertyId: id });
        return deletedRoom;
    }

    async singlePropertyById(id: any): Promise<any> {
        let room = await this.roomModel.findOne({ _id: id });
        let property = await this.propertyModel.findOne({ _id: room.propertyId })
        room.propertyId = property
        return room;
    }

}
