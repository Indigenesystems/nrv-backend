import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { Room } from './entities/room.entity';
import { Property } from '../properties/entities/property.entity';
import {
  Application,
  ApplicationStatus,
} from '../properties/entities/application.entity';
import { CloudinaryService } from '../upload/cloudinary.service';
import { LandlordAssignedTenant } from '../properties/entities/landlord_assigned_tenant.entity';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';
import { randomInt } from 'crypto';


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
    console.log('Service received createRoomDTO:', createRoomDTO);
    console.log('Service received images:', createRoomDTO.images);
    
    let fileUrl: any = null;
    let imageUrls: any = null;

    // Upload main room image
    if (createRoomDTO.file) {
      fileUrl = await this.cloudinaryService.upload(createRoomDTO.file[0]);
    }

    // Upload multiple images
    if (createRoomDTO.images && createRoomDTO.images.length > 0) {
      console.log('Service processing images:', createRoomDTO.images);
      imageUrls = await Promise.all(
        createRoomDTO.images.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
      console.log('Service uploaded imageUrls:', imageUrls);
    } else {
      console.log('Service: No images found in createRoomDTO.images');
    }

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
      file: fileUrl,
      noOfRooms,
      noOfBaths,
      noOfPools,
      apartmentStyle,
      leaseTerms,
      paymentOption,
      otherAmentities,
      imageUrls: imageUrls || [],
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
      // For tenant view, only show available (unoccupied) rooms that are listed
      query = this.roomModel
        .find()
        .populate('propertyId')
        .where('listRoom')
        .equals(true)
        .where('assignedToTenant')
        .equals(false); // Only show unoccupied rooms
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
    
    // Apply pagination
    const skip = (page - 1) * limit;
    const properties = await query.skip(skip).limit(limit).exec();
    return properties;
  }

  async countAvailableApartments(
    search: string = '',
    minPrice?: number,
    maxPrice?: number,
  ): Promise<number> {
    let query = this.roomModel
      .find()
      .where('listRoom')
      .equals(true)
      .where('assignedToTenant')
      .equals(false);

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

    return await query.countDocuments();
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
      let activeTenant: any 
      activeTenant  = await this.applicationModel
        .findOne({
          propertyId: id,
        })
        .where('status')
        .equals(ApplicationStatus.ACTIVE_LEASE)
        .populate('propertyId')
        .populate('applicant');

        if (!activeTenant){
          activeTenant =  await this.landlordAssignedTenantModel
          .findOne({
            propertyId: id,
          })
          .where('status')
          .equals(ApplicationStatus.ACTIVE_LEASE)
          .populate('propertyId')
          .populate('applicant');
        }
      return activeTenant;
    } catch (error) {
      throw new NotFoundException(error);
    }
  }

  async findRentedApartments(id: any): Promise<any> {
    try {
      const now = new Date();
      const rentedApartments: any = await this.applicationModel
        .find({
          ownerId: id,
          // rentStartDate: { $lte: now },
          // rentEndDate: { $gte: now },
        })
        .where('status')
        .equals(ApplicationStatus.ACTIVE_LEASE)
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
          ownerId: new mongoose.Types.ObjectId(id),
          status: ApplicationStatus.ACTIVE_LEASE,
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
    const singleApp = await this.applicationModel.findById(id);
    this.roomModel.findByIdAndUpdate(
      singleApp.propertyId,
      { assignedToTenant: true, listRoom: false },
      { new: true },
    );
    return this.applicationModel.findByIdAndUpdate(
      id,
      { rentEndDate, rentStartDate, status: ApplicationStatus.ACTIVE_LEASE },
      { new: true },
    );
  }

  async endRentTenure(id: string): Promise<LandlordAssignedTenant> {
    // First, find the tenant by ID
    let tenant;
    tenant = await this.landlordAssignedTenantModel.findById(id);
    if (!tenant) {
      tenant = await this.applicationModel.findById(id);
    } else {
      throw new Error('Application does not exists!');
    }

    // Set status to 'ended' (or any other status you want)
    tenant.status = ApplicationStatus.ENDED;
    tenant.rentEndDate = new Date(); // Set rentEndDate to current date (or provide a custom date)

    // Save the updated tenant
    return tenant.save();
  }
}
