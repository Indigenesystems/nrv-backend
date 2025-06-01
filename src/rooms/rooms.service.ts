import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { Room } from './entities/room.entity';
import { Property } from '../properties/entities/property.entity';
import { Application } from '../properties/entities/application.entity';
import { CloudinaryService } from '../upload/cloudinary.service';
import { LandlordAssignedTenant } from 'src/properties/entities/landlord_assigned_tenant.entity';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';
import { randomInt } from 'crypto';
import { ApiProperty } from '@nestjs/swagger';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(LandlordAssignedTenant.name)
    private readonly landlordAssignedTenantModel: Model<LandlordAssignedTenant>,
    @InjectModel(AgreementDocuments.name)
    private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createRooms(createRoomDTO: any) {
    //const fileUrl = await this.cloudinaryService.upload(createRoomDTO.file[0]);

    let {
      description,
      propertyId,
      apartmentType,
      rentAmountMetrics,
      rentAmount,
      noOfRooms,
      noOfBaths,
      noOfPools,
      apartmentStyle,
      leaseTerms,
      paymentOption,
      otherAmentities,
    }: any = createRoomDTO;

    const parsedRentAmount = parseInt(rentAmount);

    if (typeof otherAmentities === 'string') {
      otherAmentities = JSON.parse(otherAmentities);
    }

    const finalPayload = {
      roomId: randomInt(10000000),
      description,
      propertyId,
      apartmentType,
      rentAmountMetrics,
      rentAmount: parsedRentAmount,
      noOfRooms,
      noOfBaths,
      noOfPools,
      apartmentStyle,
      leaseTerms,
      paymentOption,
      otherAmentities,
    };

    try {
      const newRoom = await this.roomModel.create(finalPayload);

      //  Update the related property's rooms array with the new room's ID
      await this.propertyModel.findByIdAndUpdate(
        propertyId,
        { $push: { rooms: newRoom._id } },
        { new: true },
      );
      return newRoom;
    } catch (error) {
      throw new Error(`Failed to create room: ${error.message}`);
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
    const room = await this.roomModel.findOne({ _id: id });
    const property = await this.propertyModel.findOne({ _id: room.propertyId });
    room.propertyId = property;
    return room;
  }

  async updateSubPropertyStatus(id: any, newStatus: boolean): Promise<any> {
    try {
      const room: any = await this.roomModel.findOne({ _id: id });
      room.propertyId = room.propertyId;
      room.listRoom = newStatus;
      return room.save();
    } catch (error) {
      throw new Error(`Failed to update sub property status: ${error}`);
    }
  }

  async findAllApartments(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    minPrice?: number,
    maxPrice?: number,
    id?: any,
  ): Promise<any> {
    let query = null;

    if (id) {
      const rooms = await this.roomModel.find().populate('propertyId').exec();

      query = rooms.filter((room) => {
        if (room.propertyId.createdBy instanceof mongoose.Types.ObjectId) {
          return (
            room.propertyId &&
            room.propertyId.createdBy == new mongoose.Types.ObjectId(id)
          );
        } else {
          return room.propertyId && room.propertyId.createdBy === id;
        }
      });
    } else {
      query = this.roomModel
        .find()
        .populate('propertyId')
        .where('listRoom')
        .equals(true);
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.or([
        {
          propertyId: {
            $in: await this.propertyModel
              .find({ state: searchRegex })
              .distinct('_id'),
          },
        },
        {
          propertyId: {
            $in: await this.propertyModel
              .find({ city: searchRegex })
              .distinct('_id'),
          },
        },
        {
          propertyId: {
            $in: await this.propertyModel
              .find({ streetAddress: searchRegex })
              .distinct('_id'),
          },
        },
      ]);
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query = query.where('rentAmount');
      if (minPrice !== undefined) {
        query = query.gte(minPrice);
      }
      if (maxPrice !== undefined) {
        query = query.lte(maxPrice);
      }
    }
    const properties = await query;
    return properties;
  }

  async findPropertyByIdForTenant(id: any, tenantId: any): Promise<any> {
    const property: any = await this.roomModel.findOne({ _id: id }).populate({
      path: 'propertyId',
      populate: { path: 'createdBy' },
    });
    const hasTenantApplied: any = await this.applicationModel.findOne({
      applicant: tenantId,
      propertyId: id,
    });

    const agreementDocument = await this.agreementDocumentsModel.findOne({
      applicant: tenantId,
    });

    if (property && hasTenantApplied != null) {
      return { property, hasApplied: true, agreementDocument };
    }
    if (property && hasTenantApplied == null) {
      return { property, hasApplied: false, agreementDocument };
    }
    return new NotFoundException();
  }

  async findCurrentOccupantForRoom(id: any): Promise<any> {
    try {
      const iactiveTenant: any = await this.applicationModel
        .findOne({
          propertyId: id,
        })
        .where('status')
        .equals('activeTenant')
        .populate('propertyId')
        .populate('applicant');
      return iactiveTenant;
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  async findRentedApartments(id: any): Promise<any> {
    try {
      const now = new Date();
      const rentedApartments: any = await this.applicationModel
        .find({
          applicant: id,
          // rentStartDate: { $lte: now },
          // rentEndDate: { $gte: now },
        })
        .where('status')
        .equals('activeTenant')
        .populate({
          path: 'propertyId',
          populate: {
            path: 'propertyId', // Populate nested field inside 'propertyId'
          },
        })
        .populate('applicant')
        .populate('ownerId');

      const x = await this.landlordAssignedTenantModel
        .find({
          applicant: new mongoose.Types.ObjectId(id),
          status: 'active',
        })
        .populate('propertyId')
        .populate('applicant')
        .populate('ownerId')
        .lean();

      return [...rentedApartments, ...x];
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  async updateRentEndDate(
    id: string,
    rentEndDate: Date,
  ): Promise<LandlordAssignedTenant | null> {
    try {
      // Attempt to update the landlordAssignedTenantModel
      const updatedTenant =
        await this.landlordAssignedTenantModel.findByIdAndUpdate(
          id,
          { rentEndDate },
          { new: true },
        );

      // If the first update succeeds, return the result
      if (updatedTenant) {
        return updatedTenant;
      }

      // Fallback to updating the applicationModel
      const updatedApplication = await this.applicationModel.findByIdAndUpdate(
        id,
        { rentEndDate },
        { new: true },
      );

      // Return the result of the fallback update
      return updatedApplication || null;
    } catch (error) {
      // Handle any errors
      console.error(`Error updating rent end date for ID: ${id}`, error);
      throw new Error(
        'Unable to update rent end date. Please try again later.',
      );
    }
  }

  async assignStartAndEndDate(
    id: string,
    rentEndDate: Date,
    rentStartDate: Date,
  ): Promise<LandlordAssignedTenant | any> {
    return this.applicationModel.findByIdAndUpdate(
      id,
      { rentEndDate, rentStartDate },
      { new: true },
    );
  }

  async endRentTenure(id: string): Promise<LandlordAssignedTenant> {
    // First, find the tenant by ID
    const tenant = await this.landlordAssignedTenantModel.findById(id);
    if (!tenant) {
      throw new Error('LandlordAssignedTenant not found');
    }

    // Set status to 'ended' (or any other status you want)
    tenant.status = 'ended';
    tenant.rentEndDate = new Date(); // Set rentEndDate to current date (or provide a custom date)

    // Save the updated tenant
    return tenant.save();
  }
}
