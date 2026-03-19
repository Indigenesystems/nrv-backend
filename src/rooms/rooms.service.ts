import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import axios from 'axios';
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
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    private activitiesService: ActivitiesService,
    private notificationsService: NotificationsService,
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
      listRoom: false,
      assignedToTenant: false,
      approved: false,
      approvalRequested: false,
      approvalRequestedAt: null,
    };

    try {
      const newRoom = await this.roomModel.create(finalPayload);

      //  Update the related property's rooms array with the new room's ID
      const property = await this.propertyModel.findById(propertyId);
      await this.propertyModel.findByIdAndUpdate(
        propertyId,
        { $push: { rooms: newRoom._id } },
        { new: true },
      );

      // Record activity
      const createdBy = property?.createdBy as any;
      const userId =
        typeof createdBy === 'object' ? createdBy?._id?.toString() : createdBy?.toString();
      if (userId) {
        await this.activitiesService.create({
          type: 'Unit Added',
          details: `${newRoom.description || 'New unit'} added to property`,
          userId,
          metadata: { roomId: newRoom._id, propertyId },
        });
      }

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
      const room: any = await this.roomModel
        .findOne({ _id: id })
        .populate({ path: 'propertyId', populate: { path: 'createdBy' } });
      room.listRoom = newStatus;
      const savedRoom = await room.save();

      // Record activity
      const property = room.propertyId as any;
      const createdBy = property?.createdBy;
      const userId =
        typeof createdBy === 'object' ? createdBy?._id?.toString() : createdBy?.toString();
      if (userId) {
        const activityType = newStatus ? 'Unit Listed' : 'Unit Unlisted';
        const activityDetails = newStatus
          ? `${room.description || 'Unit'} is now listed for rent`
          : `${room.description || 'Unit'} has been unlisted`;
        await this.activitiesService.create({
          type: activityType,
          details: activityDetails,
          userId,
          metadata: { roomId: id, propertyId: property?._id },
        });
      }

      return savedRoom;
    } catch (error) {
      throw new Error(`Failed to update sub property status: ${error}`);
    }
  }

  /**
   * Landlord: request admin approval for this room to be publicly listed.
   * Sets approvalRequested=true and ensures listRoom=true so the admin can approve it.
   */
  async requestRoomApproval(id: string): Promise<any> {
    const room = await this.roomModel.findByIdAndUpdate(
      id,
      {
        approvalRequested: true,
        approvalRequestedAt: new Date(),
        listRoom: true,
      },
      { new: true },
    );
    if (!room) throw new NotFoundException('Room not found');

    // Populate related data for notification + webhook payload
    let property: any = null;
    try {
      const populated = await this.roomModel
        .findById(id)
        .populate({
          path: 'propertyId',
          populate: { path: 'createdBy' },
        })
        .lean();
      property = populated?.propertyId ?? null;
    } catch {
      // best-effort; don't fail the main request
    }

    const roomId = room?._id?.toString?.() ?? String(id);
    const propertyId = property?._id?.toString?.() ?? null;
    const landlordId =
      property?.createdBy?._id?.toString?.() ||
      property?.createdBy?.toString?.() ||
      null;
    const timestamp = new Date().toISOString();

    // 1) In-app notification (admin)
    try {
      await this.notificationsService.create({
        targetRole: 'admin',
        type: 'listing_approval_requested',
        title: 'Listing approval requested',
        body: `A landlord requested listing approval for a unit. Room ID: ${roomId}${
          propertyId ? `, Property ID: ${propertyId}` : ''
        }.`,
        metadata: { roomId, propertyId, landlordId, timestamp },
      });
    } catch (err: any) {
      // best-effort
      // eslint-disable-next-line no-console
      console.error(
        '[RoomsService] Failed to create approval notification:',
        err?.message || err,
      );
    }

    // 2) Outbound webhook (optional)
    const webhookUrl = process.env.LISTING_APPROVAL_WEBHOOK_URL;
    if (webhookUrl && webhookUrl.trim()) {
      try {
        await axios.post(
          webhookUrl.trim(),
          { roomId, propertyId, landlordId, timestamp },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          },
        );
      } catch (err: any) {
        // best-effort
        // eslint-disable-next-line no-console
        console.error(
          '[RoomsService] Listing approval webhook failed:',
          err?.message || err,
        );
      }
    }

    return room;
  }

  /**
   * Admin: approve/unapprove a room for public visibility.
   * When approving (approved=true), require:
   * - room.approvalRequested === true
   * - property.status === 'active'
   */
  async setRoomApproval(id: string, approved: boolean): Promise<any> {
    const room: any = await this.roomModel
      .findById(id)
      .populate('propertyId')
      .lean();
    if (!room) throw new NotFoundException('Room not found');

    if (approved) {
      const approvalRequested = room.approvalRequested === true;
      const propertyActive =
        room.propertyId &&
        (room.propertyId.status ?? 'active').toLowerCase() === 'active';

      if (!approvalRequested) {
        throw new BadRequestException(
          'Cannot approve: landlord must request approval first.',
        );
      }
      if (!propertyActive) {
        throw new BadRequestException('Cannot approve: property is not active.');
      }
    }

    const updated: any = await this.roomModel.findByIdAndUpdate(
      id,
      { approved },
      { new: true },
    );
    return updated;
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
        .where('approved')
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

    // Most recent first (for tenant/landing view)
    if (!id) {
      query = query.sort({ createdAt: -1 });
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
      .where('approved')
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

  /** Rented apartments where the given id is the tenant (applicant). */
  async findRentedApartmentsByTenantId(tenantId: any): Promise<any> {
    try {
      const rentedFromApplications: any = await this.applicationModel
        .find({ applicant: tenantId })
        .where('status')
        .equals(ApplicationStatus.ACTIVE_LEASE)
        .populate({
          path: 'propertyId',
          populate: { path: 'propertyId' },
        })
        .populate('applicant')
        .populate('ownerId')
        .lean();

      const rentedFromAssigned: any = await this.landlordAssignedTenantModel
        .find({
          applicant: new mongoose.Types.ObjectId(tenantId),
          status: ApplicationStatus.ACTIVE_LEASE,
        })
        .populate('propertyId')
        .populate('applicant')
        .populate('ownerId')
        .lean();

      return [...rentedFromApplications, ...rentedFromAssigned];
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
    // Find the tenant by ID in either LandlordAssignedTenant or Application
    let tenant = await this.landlordAssignedTenantModel.findById(id);
    if (!tenant) {
      tenant = await this.applicationModel.findById(id);
    }
    if (!tenant) {
      throw new Error('Application does not exists!');
    }

    // Set status to 'ended' (or any other status you want)
    tenant.status = ApplicationStatus.ENDED;
    tenant.rentEndDate = new Date(); // Set rentEndDate to current date (or provide a custom date)

    // Save the updated tenant
    return tenant.save();
  }
}
