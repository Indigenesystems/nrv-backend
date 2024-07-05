import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room } from './entities/room.entity';
import { CreateRoomDTO } from './dto/create-room.dto';
import { PropertiesService } from '../properties/properties.service';
import { Property } from '../properties/entities/property.entity';
import { Application } from '../properties/entities/application.entity';
import { CloudinaryService } from '../upload/cloudinary.service';

@Injectable()
export class RoomsService {
    constructor(
        @InjectModel(Room.name) private readonly roomModel: Model<Room>,
        @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
        @InjectModel(Application.name)
        private readonly applicationModel: Model<Application>,
        private cloudinaryService: CloudinaryService,
    ) { }

    async createRooms(createRoomDTO: any) {
        const latestRoom = await this.roomModel
            .findOne({}, { roomId: 1 })
            .sort({ roomId: -1 })
            .limit(1);
        const maxRoomId = latestRoom ? latestRoom.roomId : 0;
        const fileUrl = await this.cloudinaryService.upload(createRoomDTO.file[0]);
        const roomId = maxRoomId + 1;
     

        const {
            name,
            description,
            propertyId,
            targetDeposit,
            targetRent,
            rentAmountMetrics,
            rentAmount,
            noOfRooms,
            noOfBaths,
            noOfPools,
            otherAmentities,
        } = createRoomDTO;


        const finalPayload = {
            roomId,
            name,
            description,
            propertyId,
            targetDeposit,
            targetRent,
            rentAmountMetrics,
            rentAmount,
            noOfRooms,
            noOfBaths,
            noOfPools,
            otherAmentities,
            file: fileUrl
        };


        try {
            const newRoom = await this.roomModel.create(finalPayload);
            return newRoom;
        } catch (error) {
            throw new Error(`Failed to create rooms: ${error.message}`);
        }
    }

    async roomByPropertyId(id: any): Promise<any> {
        return await this.roomModel.find({ propertyId: id });
    }

    async deleteRoomByPropertyId(id: any) {
        const deletedRoom: any = await this.roomModel.deleteMany({
            propertyId: id,
        });
        return deletedRoom;
    }

    async singlePropertyById(id: any): Promise<any> {
        let room = await this.roomModel.findOne({ _id: id });
        let property = await this.propertyModel.findOne({ _id: room.propertyId });
        room.propertyId = property
        return room;
    }

    async updateSubPropertyStatus(id: any, newStatus: boolean): Promise<any> {
        try {

            let room = await this.roomModel.findOne({ _id: id });
            let property = await this.propertyModel.findOne({ _id: room.propertyId });
            room.propertyId = property;
            room.listRoom = newStatus;
            return room.save();
        } catch (error) {
            throw new Error(`Failed to update sub property status: ${error}`);
        }
    }

    async findAllApartments(page: number = 1, limit: number = 10): Promise<any> {
        const skip = (page - 1) * limit;
        const properties = await this.roomModel
            .find().populate('propertyId')
            .where('listRoom').equals(true)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        return properties;
    }

    async findPropertyByIdForTenant(id: any, tenantId: any): Promise<any> {
 
        let property: any = await this.roomModel
            .findOne({ _id: id })
            .populate({
                path: 'propertyId',
                populate: { path: 'createdBy' }
            });
   
            
        let hasTenantApplied: any = await this.applicationModel.findOne({
            applicant: tenantId, propertyId: id,
        });

        if (property && hasTenantApplied != null) {
            
            return {property, "hasApplied": true};
        }

        if (property && hasTenantApplied == null) {
            return {property, "hasApplied": false};
        }
        return new NotFoundException();
    }

}
