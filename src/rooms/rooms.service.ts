import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room } from './entities/room.entity';
import { CreateRoomDTO } from './dto/create-room.dto';

@Injectable()
export class RoomsService {

    constructor(
        @InjectModel(Room.name) private readonly roomModel: Model<Room>
    ) { }

    // async createRoom(createRoomDTO: CreateRoomDTO) {

    //     let { name, description, propertyId, targetDeposit, targetRent } = createRoomDTO;
    //     const latestRoom: any = await this.roomModel.aggregate([
    //         { $sort: { roomId: -1 } },
    //         { $limit: 1 }
    //     ]);
    //     const roomNumber = latestRoom ? parseInt(latestRoom[0].roomId)  + 1 : 1;
    //     const room = {
    //         name,
    //         description,
    //         propertyId,
    //         targetDeposit,
    //         targetRent,
    //         roomId: roomNumber
    //     };
    //     const newRoom = new this.roomModel(room);
    //     return await newRoom.save();
    // }

    async createRooms(createRoomDTOs: CreateRoomDTO[]) {
        console.log({createRoomDTOs});
        
        // Find the room with the highest roomId
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
            // Create multiple room entries
            const newRooms = await this.roomModel.create(rooms);
            return newRooms;
        } catch (error) {
            // Handle error if any
            throw new Error(`Failed to create rooms: ${error.message}`);
        }
    }
    
    

    async roomByPropertyId(id: any): Promise<any> {
        return await this.roomModel.find({propertyId: id});
    }

}
