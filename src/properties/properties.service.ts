import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { Property } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';
import { Application, ApplicationStatus } from './entities/application.entity';
import { EmailService } from '../email-sender/email.service';
import { LandlordAssignedTenant } from './entities/landlord_assigned_tenant.entity';
import { User } from '../users/entities/user.entity';
import {
  Maintenance,
  MaintenanceStatus,
} from 'src/maintenance/entities/maintenance.entity';
import { AgreementDocuments } from './entities/agreement_documents.entity';
import { Room } from 'src/rooms/entities/room.entity';
import { randomInt } from 'crypto';
import axios from 'axios';

import { populate } from 'dotenv';
import { ActivitiesService } from '../activities/activities.service';
import { PlansService } from '../plans/plans.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Maintenance.name)
    private readonly maintenanceModel: Model<Maintenance>,
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
    @InjectModel(AgreementDocuments.name)
    private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    @InjectModel(LandlordAssignedTenant.name)
    private readonly landlordAssignedTenantModel: Model<LandlordAssignedTenant>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
    private roomService: RoomsService,
    private emailService: EmailService,
    private activitiesService: ActivitiesService,
    private plansService: PlansService,
    private notificationsService: NotificationsService,
  ) {}

  async createProperty(createPropertyDto: any) {
    const createdByUserId = createPropertyDto.createdBy;
    const user = await this.userModel.findById(createdByUserId).lean();
    if (!user) {
      throw new BadRequestException('User not found');
    }
    // Properties can be added without purchasing credits; no limit enforced.

    const streetAddress = String(createPropertyDto.location || createPropertyDto.streetAddress || '')
      .trim();
    const city = String(createPropertyDto.city || '').trim();
    const state = String(createPropertyDto.state || '').trim();
    if (streetAddress && city && state) {
      const duplicate = await this.propertyModel.findOne({
        createdBy: createdByUserId,
        streetAddress: new RegExp(
          `^${streetAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i',
        ),
        city: new RegExp(
          `^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i',
        ),
        state: new RegExp(
          `^${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i',
        ),
        status: { $ne: 'inactive' },
      });
      if (duplicate) {
        throw new BadRequestException(
          'A property with this address already exists on your account.',
        );
      }
    }

    let landlordInsurancePolicyUrls: any = null;
    let utilityAndMaintenanceUrls: any = null;
    let otherDocumentsUrls: any = null;
    let fileUrl: any = null;

    // Upload main property image
    if (createPropertyDto.file) {
      fileUrl = await this.cloudinaryService.upload(createPropertyDto.file[0]);
    }

    // Upload multiple files if present
    if (createPropertyDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        createPropertyDto.landlordInsurancePolicy.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
    }

    if (createPropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        createPropertyDto.utilityAndMaintenance.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
    }

    if (createPropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        createPropertyDto.otherDocuments.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
    }

    // Construct and save property
    const propertyData = {
      file: fileUrl,
      city: createPropertyDto.city,
      streetAddress: createPropertyDto.location || createPropertyDto.streetAddress,
      state: createPropertyDto.state,
      propertyType: createPropertyDto.propertyType,
      createdBy: createPropertyDto.createdBy,
      landlordInsurancePolicy: landlordInsurancePolicyUrls,
      utilityAndMaintenance: utilityAndMaintenanceUrls,
      otherDocuments: otherDocumentsUrls,
      imageUrls: [], // Remove property-level images, will be handled at room level
      preferredTenants: createPropertyDto.preferredTenants || [],
      rentCollection: createPropertyDto.rentCollection || {
        value: '',
        label: '',
      },
    };

    const newProperty = new this.propertyModel(propertyData);
    const createdProperty = await newProperty.save();

    if (createPropertyDto.units && createPropertyDto.units.length > 0) {
      const parsedUnits = JSON.parse(createPropertyDto.units);
      const unitImages = createPropertyDto.unitImages || [];
      
      console.log(`Backend received ${unitImages.length} unit images`);
      console.log(`Backend processing ${parsedUnits.length} units`);
      
      const roomDocs = await Promise.all(
        parsedUnits.map(async (room: any, index: number) => {
          let roomImageUrls: any = null;
          
          // Calculate which images belong to this unit
          // Assuming 5 images per unit, calculate the range for this unit
          const imagesPerUnit = 5;
          const startIndex = index * imagesPerUnit;
          const endIndex = startIndex + imagesPerUnit;
          const unitImageFiles = unitImages.slice(startIndex, endIndex);
          
          console.log(`Unit ${index + 1}: ${unitImageFiles.length} images`);
          
          // Upload multiple images for each room
          if (unitImageFiles && unitImageFiles.length > 0) {
            roomImageUrls = await Promise.all(
              unitImageFiles.map(
                async (file: Express.Multer.File) =>
                  this.cloudinaryService.upload(file),
              ),
            );
          }

          const rawRent = String(room?.rentAmount ?? '').replace(/,/g, '');
          if (rawRent.includes('-')) {
            throw new BadRequestException(
              'Rent amount must be a positive number greater than zero.',
            );
          }
          const parsed = Number(rawRent);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new BadRequestException(
              'Rent amount must be a positive number greater than zero.',
            );
          }

          return this.roomModel.create({
            ...room,
            rentAmount: parsed,
            roomId: randomInt(10000000),
            propertyId: createdProperty._id,
            imageUrls: roomImageUrls || [], // Add room-level images
          });
        }),
      );

      // Update property with linked rooms
      createdProperty.rooms = roomDocs.map((room) => room._id);
      await createdProperty.save();

      // Log "Unit Added" activity for each unit
      const createdBy = createdProperty.createdBy as any;
      const userId =
        typeof createdBy === 'object' ? createdBy?._id?.toString() : createdBy?.toString();
      if (userId) {
        for (const room of roomDocs) {
          await this.activitiesService.create({
            type: 'Unit Added',
            details: `${(room as any).description || 'New unit'} added to property`,
            userId,
            metadata: { roomId: (room as any)._id, propertyId: createdProperty._id },
          });
        }
      }
    }

    // Log activity
    const createdByRef = createdProperty.createdBy as any;
    const userId =
      typeof createdByRef === 'object' ? createdByRef?._id?.toString() : createdByRef?.toString();
    if (userId) {
      await this.activitiesService.create({
        type: 'Property Added',
        details: `${createdProperty.propertyName || createdProperty.streetAddress || 'New property'} has been added`,
        userId,
        metadata: { propertyId: createdProperty._id },
      });
    }

    return createdProperty;
  }

  async updateProperty(updatePropertyDto: any) {
    let landlordInsurancePolicyUrls: any = [];
    let utilityAndMaintenanceUrls: any = [];
    let otherDocumentsUrls: any = [];
    let imageUrls: any = [];

    const singleProperty = await this.propertyModel.findById(
      updatePropertyDto?.query,
    );
    if (!singleProperty) {
      throw new NotFoundException('Property not found');
    }

    // Ensure properties are arrays to avoid "not iterable" errors
    singleProperty.landlordInsurancePolicy =
      singleProperty.landlordInsurancePolicy || [];
    singleProperty.utilityAndMaintenance =
      singleProperty.utilityAndMaintenance || [];
    singleProperty.otherDocuments = singleProperty.otherDocuments || [];
    singleProperty.imageUrls = singleProperty.imageUrls || [];

    // Upload landlord insurance policies
    if (updatePropertyDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        updatePropertyDto.landlordInsurancePolicy.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );

      singleProperty.landlordInsurancePolicy.push(
        ...landlordInsurancePolicyUrls,
      );
    }

    // Upload utility and maintenance documents
    if (updatePropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        updatePropertyDto.utilityAndMaintenance.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );

      singleProperty.utilityAndMaintenance.push(...utilityAndMaintenanceUrls);
    }

    // Upload other documents
    if (updatePropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        updatePropertyDto.otherDocuments.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );

      singleProperty.otherDocuments.push(...otherDocumentsUrls);
    }

    // Upload multiple images (replace when replaceImages=true)
    if (updatePropertyDto.images && updatePropertyDto.images.length > 0) {
      imageUrls = await Promise.all(
        updatePropertyDto.images.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );

      const shouldReplace =
        updatePropertyDto.replaceImages === true ||
        updatePropertyDto.replaceImages === 'true';
      if (shouldReplace) {
        singleProperty.imageUrls = imageUrls;
      } else {
        singleProperty.imageUrls.push(...imageUrls);
      }
    }

    // Upload/replace main property image (file)
    if (updatePropertyDto.file) {
      const fileToUpload = Array.isArray(updatePropertyDto.file)
        ? updatePropertyDto.file[0]
        : updatePropertyDto.file;
      if (fileToUpload) {
        singleProperty.file = await this.cloudinaryService.upload(fileToUpload);
        // Keep marketplace thumbnails in sync when units rely on property image
        await this.roomModel.updateMany(
          {
            propertyId: singleProperty._id,
            $or: [
              { imageUrls: { $exists: false } },
              { imageUrls: { $size: 0 } },
              { imageUrls: null },
            ],
          },
          { $set: { file: singleProperty.file } },
        );
      }
    }

    // Update other properties
    if (updatePropertyDto.unit) {
      (singleProperty as any).unit = updatePropertyDto.unit;
    }
    if (updatePropertyDto.city) {
      singleProperty.city = updatePropertyDto.city;
    }
    if (updatePropertyDto.location && !updatePropertyDto.streetAddress) {
      singleProperty.streetAddress = updatePropertyDto.location;
    }
    if (updatePropertyDto.propertyType) {
      try {
        singleProperty.propertyType =
          typeof updatePropertyDto.propertyType === 'string'
            ? JSON.parse(updatePropertyDto.propertyType)
            : updatePropertyDto.propertyType;
      } catch {
        singleProperty.propertyType = updatePropertyDto.propertyType;
      }
    }
    if (updatePropertyDto.rentCollection) {
      try {
        singleProperty.rentCollection =
          typeof updatePropertyDto.rentCollection === 'string'
            ? JSON.parse(updatePropertyDto.rentCollection)
            : updatePropertyDto.rentCollection;
      } catch {
        // If it's not valid JSON, store as-is (best effort)
        singleProperty.rentCollection = updatePropertyDto.rentCollection;
      }
    }
    if (updatePropertyDto.streetAddress) {
      singleProperty.streetAddress = updatePropertyDto.streetAddress;
    }
    if (updatePropertyDto.state) {
      singleProperty.state = updatePropertyDto.state;
    }
    if (updatePropertyDto.status) {
      singleProperty.status = updatePropertyDto.status;
      // Soft-remove from marketplace when property is inactivated
      if (String(updatePropertyDto.status).toLowerCase() === 'inactive') {
        await this.roomModel.updateMany(
          { propertyId: singleProperty._id },
          { $set: { listRoom: false } },
        );
      }
    }

    // Persist changes on the mongoose document (avoid writing computed/join fields).
    return await singleProperty.save();
  }

  async findPropertyByUserId(
    id: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const properties = await this.propertyModel
      .find({ createdBy: id })
      .populate('createdBy') // Corrected populate usage
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec(); // Add exec to properly execute the query

    return properties;
  }

  async _findAllProperty(page: number = 1, limit: number = 10): Promise<any> {
    const skip = (page - 1) * limit;
    const properties = await this.propertyModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    return properties;
  }

  async findAllProperty(
    page: number = 1,
    limit: number = 10,
    userId?: any,
    search: string = '',
    minPrice?: number,
    maxPrice?: number,
  ): Promise<any> {
    const searchRegex = new RegExp(search, 'i');
    const propertyQuery: any = {};

    if (userId) {
      propertyQuery.createdBy = userId;
      propertyQuery.status = { $ne: 'deleted' };
    }

    if (search) {
      propertyQuery.$or = [
        { state: searchRegex },
        { city: searchRegex },
        { streetAddress: searchRegex },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Fetch properties with rooms populated
    const allProperties = await this.propertyModel
      .find(propertyQuery)
      .populate({
        path: 'rooms',
        model: 'Room',
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const filteredProperties = allProperties.map((property) => {
      const rooms = property.rooms || [];

      // Apply rent filtering if needed
      const filteredRooms = rooms.filter((room: any) => {
        const rent = room.rentAmount;
        if (typeof rent !== 'number') return false;

        if (minPrice !== undefined && rent < minPrice) return false;
        if (maxPrice !== undefined && rent > maxPrice) return false;
        return true;
      });

      // Enrich the property data
      return {
        ...property.toObject(),
        apartments: filteredRooms,
        apartmentCount: filteredRooms.length,
        unitsLeft: filteredRooms.filter((room) => !room.assignedToTenant)
          .length,
      };
    });

    return filteredProperties;
  }

  async findAllPropertyByUserIdWithPagination(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ data: any[]; totalPages: number; total: number; page: number; limit: number }> {
    const { userId, page, limit } = params;
    const [data, total] = await Promise.all([
      this.findAllProperty(page, limit, userId),
      this.propertyModel.countDocuments({
        createdBy: userId,
        status: { $ne: 'deleted' },
      }),
    ]);
    return {
      data: Array.isArray(data) ? data : [],
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      page,
      limit,
    };
  }

  /**
   * Find all properties with enhanced pagination and filtering
   * @param params
   * @returns Paginated properties with metadata
   */
  /** Property IDs with at least one unit awaiting admin listing approval. */
  private async getPendingListingApprovalPropertyIds(): Promise<mongoose.Types.ObjectId[]> {
    const roomPropertyIds = await this.roomModel.distinct('propertyId', {
      approvalRequested: true,
      approved: { $ne: true },
    });
    if (!roomPropertyIds.length) {
      return [];
    }
    const activeProperties = await this.propertyModel
      .find({
        _id: { $in: roomPropertyIds },
        $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
      })
      .select('_id')
      .lean();
    return activeProperties.map((p) => p._id as mongoose.Types.ObjectId);
  }

  async countPendingListingApprovals(): Promise<number> {
    const ids = await this.getPendingListingApprovalPropertyIds();
    return ids.length;
  }

  async findAllPropertyWithPagination(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    propertyType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    pendingListingApproval?: boolean;
  }): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number } }> {
    const { page, limit, search, status, propertyType, sortBy, sortOrder, pendingListingApproval } =
      params;
    
    // Build query
    let query: any = {};
    
    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query = {
        $or: [
          { streetAddress: searchRegex },
          { city: searchRegex },
          { state: searchRegex },
        ],
      };
    }
    
    // Status filter — default excludes soft-deleted listings from admin "all"
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'deleted' };
    }
    
    // Property type filter (stored as { value, label } or legacy string)
    if (propertyType && propertyType !== 'all') {
      const normalized = String(propertyType).trim().toLowerCase();
      const typePatterns: Record<string, RegExp> = {
        apartment: /apartment|flat|duplex|bedroom/i,
        house: /house|bungalow|detached|semi/i,
        commercial: /commercial|office|warehouse|shop/i,
      };
      const pattern =
        typePatterns[normalized] ||
        new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const typeClause = {
        $or: [
          { 'propertyType.value': pattern },
          { 'propertyType.label': pattern },
          { propertyType: pattern },
        ],
      };
      query =
        Object.keys(query).length > 0
          ? { $and: [query, typeClause] }
          : typeClause;
    }

    if (pendingListingApproval) {
      const pendingIds = await this.getPendingListingApprovalPropertyIds();
      query._id = { $in: pendingIds.length ? pendingIds : [null] };
    }
    
    // Build sort object
    let sort: any = { createdAt: -1 }; // Default: most recent first
    if (sortBy) {
      sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    }
    
    // Calculate skip
    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await this.propertyModel.countDocuments(query);
    
    // Get paginated results with populated rooms
    const properties = await this.propertyModel
      .find(query)
      .populate({
        path: 'rooms',
        model: 'Room',
      })
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();
    
    // Process properties to include apartment counts and other metadata
    const processedProperties = properties.map((property) => {
      const rooms = property.rooms || [];
      return {
        ...property.toObject(),
        propertyType: property.propertyType?.value || property.propertyType || 'Unknown',
        apartments: rooms,
        apartmentCount: rooms.length,
        unitsLeft: rooms.filter((room: any) => !room.assignedToTenant).length,
      };
    });
    
    return {
      data: processedProperties,
      pagination: {
        total,
        page,
        limit,
      },
    };
  }

  async findPropertyById(id: any): Promise<any> {
    const property = await this.propertyModel
      .findById(id)
      .populate('createdBy')
      .populate({
        path: 'rooms',
        model: 'Room',
        options: { sort: { createdAt: -1 } },
      })
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Extract and filter rooms if necessary
    const rooms = property.rooms || [];

    return {
      _id: property._id,
      streetAddress: property.streetAddress,
      city: property.city,
      state: property.state,
      zipCode: (property as any).zipCode,
      propertyName: (property as any).propertyName,
      status: property.status ?? 'active',
      otherDocuments: property.otherDocuments,
      utilityAndMaintenance: property.utilityAndMaintenance,
      landlordInsurancePolicy: property.landlordInsurancePolicy,
      propertyType: property.propertyType,
      file: property.file,
      imageUrls: (property as any).imageUrls || [],
      createdBy: property.createdBy,
      preferredTenants: property.preferredTenants || [],
      rentCollection: property.rentCollection || { value: '', label: '' },
      rooms,
      apartments: rooms,
      apartmentCount: rooms.length,
      unitsLeft: rooms.filter((room: any) => !room.assignedToTenant).length,
      createdAt: (property as any).createdAt,
      updatedAt: (property as any).updatedAt,
    };
  }

  async findPropertyByIdForTenant(id: any, tenantId: any): Promise<any> {
    const result: any = {};
    const property: any = await this.propertyModel
      .findOne({ _id: id })
      .populate('createdBy');
    const hasTenantApplied: any = await this.applicationModel.findOne({
      applicant: tenantId,
      propertyId: id,
    });
    if (property && hasTenantApplied != null) {
      const rooms = await this.roomService.roomByPropertyId(id);
      result._id = property._id;
      result.streetAddress = property.streetAddress;
      result.unit = property.unit;
      result.city = property.city;
      result.state = property.state;
      result.otherDocuments = property.otherDocuments;
      result.utilityAndMaintenance = property.utilityAndMaintenance;
      result.landlordInsurancePolicy = property.landlordInsurancePolicy;
      result.propertyType = property.propertyType;
      result.file = property.file;
      result.createdBy = property.createdBy;
      result.rooms = rooms;
      result.hasApplied = true;

      return result;
    }

    if (property && hasTenantApplied == null) {
      const rooms = await this.roomService.roomByPropertyId(id);
      result._id = property._id;
      result.streetAddress = property.streetAddress;
      result.unit = property.unit;
      result.city = property.city;
      result.state = property.state;
      result.otherDocuments = property.otherDocuments;
      result.utilityAndMaintenance = property.utilityAndMaintenance;
      result.landlordInsurancePolicy = property.landlordInsurancePolicy;
      result.propertyType = property.propertyType;
      result.file = property.file;
      result.createdBy = property.createdBy;
      result.rooms = rooms;

      result.hasApplied = false;

      return result;
    }
    return new NotFoundException();
  }

  async deletePropertyById(id: any) {
    const propertyToDelete = await this.propertyModel.findById(id);
    if (!propertyToDelete) {
      return null;
    }

    const alreadyDeleted =
      String((propertyToDelete as any).status || '').toLowerCase() === 'deleted';
    if (alreadyDeleted) {
      return propertyToDelete;
    }

    // Block delete when any unit is rented / has an active lease
    const roomIds = await this.roomModel.find({ propertyId: id }).distinct('_id');
    const occupiedRoom = await this.roomModel
      .findOne({ propertyId: id, assignedToTenant: true })
      .lean();
    const activeLease = await this.applicationModel
      .findOne({
        propertyId: { $in: roomIds },
        status: {
          $in: [
            ApplicationStatus.ACTIVE_LEASE,
            ApplicationStatus.ACCEPTED,
            'Active_lease',
            'Accepted',
            'active',
          ],
        },
      })
      .lean();
    if (occupiedRoom || activeLease) {
      throw new BadRequestException(
        'This property cannot be deleted because one or more units are rented or have an active lease.',
      );
    }

    const createdBy = propertyToDelete.createdBy as any;
    const userId =
      typeof createdBy === 'object' ? createdBy?._id?.toString() : createdBy?.toString();
    if (userId) {
      await this.activitiesService.create({
        type: 'Property Deleted',
        details: `${propertyToDelete.propertyName || propertyToDelete.streetAddress || 'Property'} has been removed`,
        userId,
        metadata: { propertyId: id },
      });
    }

    // Soft delete: unlist rooms and mark property deleted (keep for admin)
    await this.roomModel.updateMany(
      { propertyId: id },
      { $set: { listRoom: false, approved: false } },
    );
    propertyToDelete.status = 'deleted';
    await propertyToDelete.save();
    return propertyToDelete;
  }

  async deleteDocument(propertyId: string, documentUrl: string): Promise<any> {
    const property = await this.propertyModel.findById(propertyId);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const fieldsToUpdate = [
      'otherDocuments',
      'landlordInsurancePolicy',
      'utilityAndMaintenance',
    ];

    let documentFound = false;

    for (const field of fieldsToUpdate) {
      const index = property[field]?.indexOf(documentUrl);

      if (index > -1) {
        property[field].splice(index, 1);
        documentFound = true;
      }
    }

    if (documentFound) {
      await property.save();
      return { message: 'Document deleted successfully' };
    } else {
      throw new NotFoundException('Document not found');
    }
  }

  async createApplication(body: any) {
    let fileUrl = null;
    if (body.file != 'null' || null) {
      fileUrl = await this.cloudinaryService.upload(body.file[0]);
    }
    const asText = (value: unknown) => {
      const raw = Array.isArray(value) ? value[0] : value;
      if (raw == null) {
        return '';
      }
      return String(raw).trim();
    };
    const applicantProfile = body.applicant
      ? await this.userModel.findById(body.applicant).lean()
      : null;
    const monthlyIncomeRaw =
      body.monthlyIncome != null && body.monthlyIncome !== ''
        ? Number(Array.isArray(body.monthlyIncome) ? body.monthlyIncome[0] : body.monthlyIncome)
        : applicantProfile?.monthlyIncome != null && applicantProfile.monthlyIncome !== ''
          ? Number(applicantProfile.monthlyIncome)
          : undefined;
    const applicationData = {
      propertyId: body.propertyId,
      ownerId: body.ownerId,
      applicant: body.applicant,
      status: body.status,
      identificationCard: fileUrl || null,
      currentEmployer:
        asText(body.currentEmployer) || asText(applicantProfile?.currentEmployer) || undefined,
      reasonForLiving:
        asText(body.reasonForLiving) || asText(body.reasonForLeaving) || undefined,
      jobTitle: asText(body.jobTitle) || asText(applicantProfile?.jobTitle) || undefined,
      currentResidence:
        asText(body.currentResidence) ||
        asText(body.currentAddress) ||
        asText(applicantProfile?.homeAddress) ||
        undefined,
      monthlyIncome:
        monthlyIncomeRaw != null && !Number.isNaN(monthlyIncomeRaw)
          ? monthlyIncomeRaw
          : undefined,
    };

    try {
      const newApplication =
        await this.applicationModel.create(applicationData);
      // Fire-and-forget emails (do not block application creation)
      try {
        const [landlord, applicant, room] = await Promise.all([
          this.userModel.findById(newApplication.ownerId).lean(),
          this.userModel.findById(newApplication.applicant).lean(),
          this.roomModel
            .findById(newApplication.propertyId)
            .populate('propertyId')
            .lean(),
        ]);

        const landlordName =
          `${landlord?.firstName ?? ''} ${landlord?.lastName ?? ''}`.trim() ||
          'Landlord';
        const applicantName =
          `${applicant?.firstName ?? ''} ${applicant?.lastName ?? ''}`.trim() ||
          'Applicant';

        const property: any = (room as any)?.propertyId || null;
        const propertyTitle =
          property?.propertyName ||
          property?.streetAddress ||
          (room as any)?.name ||
          'Property';
        const propertyLocation = [
          property?.streetAddress,
          property?.city,
          property?.state,
        ]
          .filter(Boolean)
          .join(', ');

        if (landlord?.email) {
          await this.emailService.sendNewPropertyApplicationNotificationToLandlord(
            {
              landlordEmail: landlord.email,
              landlordName,
              applicantName,
              applicantEmail: applicant?.email || '',
              propertyTitle,
              propertyLocation,
            },
          );
        }

        if (landlord?._id) {
          await this.notificationsService.create({
            targetRole: 'landlord',
            userId: String(landlord._id),
            type: 'application_received',
            title: `New application: ${propertyTitle}`,
            body: `${applicantName} submitted a rental application.`,
            metadata: {
              applicationId: String(newApplication._id),
              propertyTitle,
              applicantName,
              actionUrl: `/dashboard/landlord/properties/renters/${String(newApplication._id)}`,
            },
          });
        }

        if (applicant?.email) {
          await this.emailService.sendPropertyApplicationConfirmationToApplicant({
            applicantEmail: applicant.email,
            applicantName,
            propertyTitle,
            propertyLocation,
          });
        }

        if (applicant?._id) {
          await this.notificationsService.create({
            targetRole: 'tenant',
            userId: String(applicant._id),
            type: 'application_submitted',
            title: `Application sent: ${propertyTitle}`,
            body: 'Your rental application was submitted to the landlord.',
            metadata: {
              applicationId: String(newApplication._id),
              propertyTitle,
              actionUrl: '/dashboard/tenant/properties/applications',
            },
          });
        }
      } catch (err: any) {
        console.error(
          '[PropertiesService] Application email notification failed:',
          err?.message || err,
        );
      }
      return newApplication;
    } catch (error) {
      throw new Error(`Failed to creating application: ${error.message}`);
    }
  }

  private ownerIdMatch(id: any): Record<string, unknown> {
    if (id === undefined || id === null || id === '') {
      return { ownerId: id };
    }
    const asString = String(id);
    const variants: unknown[] = [id, asString];
    if (Types.ObjectId.isValid(asString)) {
      variants.push(new Types.ObjectId(asString));
    }
    // Deduplicate by string form while keeping ObjectId instances
    const unique: unknown[] = [];
    const seen = new Set<string>();
    for (const value of variants) {
      const key =
        value instanceof Types.ObjectId
          ? `oid:${value.toString()}`
          : `str:${String(value)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(value);
    }
    return unique.length === 1
      ? { ownerId: unique[0] }
      : { ownerId: { $in: unique } };
  }

  private normalizeApplicationStatusFilter(
    status?: string,
  ): string | { $in: string[] } | null {
    const raw = status?.trim();
    if (!raw) {
      return null;
    }
    const lower = raw.toLowerCase();
    if (lower === 'active_lease' || lower === 'active') {
      return {
        $in: [ApplicationStatus.ACTIVE_LEASE, 'active', 'Accepted'],
      };
    }
    if (lower === 'ended' || lower === 'past') {
      return {
        $in: [ApplicationStatus.ENDED, 'ended', 'ENDED'],
      };
    }
    return raw;
  }

  async getLandlordApplications(
    page: number = 1,
    limit: number = 10,
    id: any,
    status?: string
  ): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      const prefetchLimit = Math.max(1, page) * limit;
      const statusFilter = this.normalizeApplicationStatusFilter(status);

      const query: any = {
        ...this.ownerIdMatch(id),
      };
      if (statusFilter) {
        query.status = statusFilter;
      }

      // Run both queries in parallel
      const [applications, onboardedTenants] = await Promise.all([
        this.applicationModel
          .find(query)
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(prefetchLimit)
          .populate('ownerId')
          .populate({ path: 'propertyId', populate: { path: 'propertyId' } })
          .populate('applicant'),

        this.landlordAssignedTenantModel
          .find(query)
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(prefetchLimit)
          .populate('ownerId')
          .populate({ path: 'propertyId', populate: { path: 'propertyId' } })
          .populate('applicant'),
      ]);

      // Combine, de-dupe by id, and return results
      const seen = new Set<string>();
      const combined = [...applications, ...onboardedTenants]
        .filter((row: any) => {
          const key = String(row?._id || '');
          if (!key || seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        })
        .sort((a: any, b: any) => {
          const aTime = a?.updatedAt
            ? new Date(a.updatedAt).getTime()
            : a?.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;
          const bTime = b?.updatedAt
            ? new Date(b.updatedAt).getTime()
            : b?.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;
          return bTime - aTime;
        })
        .slice(skip, skip + limit);

      return combined;
    } catch (error) {
      throw new Error(`Failed to fetch landlord applications: ${error}`);
    }
  }
  

  async findApplicationyById(id: any): Promise<any> {
    const applicant = await this.applicationModel.findOne({ _id: id });
    return applicant;
  }

  async findApplicationByTenantId(
    page: number = 1,
    limit: number = 10,
    id: any,
    status: string,
  ): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      const prefetchLimit = Math.max(1, page) * limit;
      const query: any = { applicant: id };
      if (status) {
        query.status = status;
      }

      const [applications, onboarded] = await Promise.all([
        this.applicationModel
          .find(query)
          .populate('ownerId')
          .populate({
            path: 'propertyId',
            populate: { path: 'propertyId' },
          })
          .populate('applicant')
          .sort({ createdAt: -1 })
          .limit(prefetchLimit)
          .exec(),
        this.landlordAssignedTenantModel
          .find(query)
          .populate('ownerId')
          .populate({
            path: 'propertyId',
            populate: { path: 'propertyId' },
          })
          .populate('applicant')
          .sort({ createdAt: -1 })
          .limit(prefetchLimit)
          .exec(),
      ]);

      const seen = new Set<string>();
      return [...applications, ...onboarded]
        .filter((row: any) => {
          const key = String(row?._id || '');
          if (!key || seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        })
        .sort((a: any, b: any) => {
          const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(skip, skip + limit);
    } catch (error) {
      throw new Error(`Failed to fetch tenant applications: ${error}`);
    }
  }

  async withdrawApplicationByTenant(
    applicationId: string,
    tenantId: string,
  ): Promise<any> {
    const application = await this.applicationModel.findById(applicationId);
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (String((application as any).applicant) !== String(tenantId)) {
      throw new BadRequestException('You can only withdraw your own application');
    }

    const status = (application as any).status as ApplicationStatus;
    const withdrawable = [ApplicationStatus.NEW, ApplicationStatus.ACCEPTED];
    if (!withdrawable.includes(status)) {
      throw new BadRequestException(
        'This application can no longer be withdrawn',
      );
    }

    (application as any).status = ApplicationStatus.WITHDRAWN;
    return (application as any).save();
  }

  async updateApplicationStatusById(
    id: any,
    newStatus: string,
    roomId?: any,
  ): Promise<any> {
    try {
      const existingApplication = await this.applicationModel.findById(id);
      if (!existingApplication) {
        throw new NotFoundException('Application not found');
      }

      if (newStatus === ApplicationStatus.ACTIVE_LEASE) {
        const doesActiveTenantExists = await this.applicationModel
          .findOne({ propertyId: roomId })
          .where('status')
          .equals(ApplicationStatus.ACTIVE_LEASE);
        if (doesActiveTenantExists)
          return new BadRequestException(
            'This property/apartment has an active tenant',
        );
      }
      const previousStatus = (existingApplication as any)?.status;
      (existingApplication as any).status = newStatus;
      const saved = await (existingApplication as any).save();

      // When application is accepted or lease starts, mark unit as rented and unlist it.
      const occupancyStatuses = [
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.ACTIVE_LEASE,
        'Accepted',
        'Active_lease',
      ];
      if (occupancyStatuses.includes(newStatus as any)) {
        const targetRoomId =
          roomId ||
          (existingApplication as any)?.propertyId?._id ||
          (existingApplication as any)?.propertyId;
        if (targetRoomId) {
          await this.roomModel.findByIdAndUpdate(
            targetRoomId,
            { assignedToTenant: true, listRoom: false },
            { new: true },
          );
        }
      }

      // Notify applicant of status change without blocking the API response
      // (SMTP timeouts were delaying status updates by 15–20s on the client).
      if (previousStatus !== newStatus) {
        void (async () => {
          try {
            const hydrated = await this.applicationModel
              .findById(saved._id)
              .populate('applicant')
              .populate('ownerId')
              .populate({
                path: 'propertyId',
                populate: { path: 'propertyId' },
              })
              .lean();

            const applicant: any = (hydrated as any)?.applicant;
            const room: any = (hydrated as any)?.propertyId;
            const property: any = room?.propertyId;

            const applicantName =
              `${applicant?.firstName ?? ''} ${applicant?.lastName ?? ''}`.trim() ||
              applicant?.fullName ||
              'Applicant';
            const propertyTitle =
              property?.propertyName ||
              property?.streetAddress ||
              room?.name ||
              'Property';
            const propertyLocation = [
              property?.streetAddress,
              property?.city,
              property?.state,
            ]
              .filter(Boolean)
              .join(', ');

            if (applicant?.email) {
              await this.emailService.sendApplicationStatusUpdateToApplicant({
                applicantEmail: applicant.email,
                applicantName,
                status: newStatus,
                propertyTitle,
                propertyLocation,
              });
            }

            if (applicant?._id) {
              await this.notificationsService.create({
                targetRole: 'tenant',
                userId: String(applicant._id),
                type: 'application_status_updated',
                title: `Application ${newStatus}`,
                body: `Your application for ${propertyTitle} is now ${newStatus}.`,
                metadata: {
                  applicationId: String((hydrated as any)?._id || ''),
                  status: newStatus,
                  propertyTitle,
                  actionUrl: '/dashboard/tenant/properties/applications',
                },
              });
            }
          } catch (err: any) {
            console.error(
              '[PropertiesService] Status update email notification failed:',
              err?.message || err,
            );
          }
        })();
      }

      return saved;

    } catch (error) {
      throw new Error(`Failed to update application status: ${error}`);
    }
  }

  async applicationInvitation(payload: any): Promise<any> {
    try {
      await this.emailService.sendApplicationInvitation(payload);
      return 'Success';
    } catch (error) {
      throw new Error(`Failed to update application status: ${error}`);
    }
  }

  async getLandLordCount(id: any): Promise<
    | {
        totalNew: number;
        totalAccepted: number;
        totalActiveTenants: number;
        totalProperties: number;
        totalNewLastMonth: number;
        totalAcceptedLastMonth: number;
        totalActiveTenantsLastMonth: number;
        totalPropertiesLastMonth: number;
      }
    | any
  > {
    try {
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfLastMonth = new Date(startOfThisMonth.getTime() - 1);

      const totalNewPromise = this.applicationModel
        .countDocuments({ ownerId: id, status: 'New' })
        .exec();
      const totalAcceptedPromise = this.applicationModel
        .countDocuments({ ownerId: id, status: 'Accepted' })
        .exec();

      const activeLeaseQuery = {
        ownerId: id,
        status: ApplicationStatus.ACTIVE_LEASE,
      };
      const totalActiveTenantsPromise = Promise.all([
        this.applicationModel.countDocuments(activeLeaseQuery).exec(),
        this.landlordAssignedTenantModel.countDocuments(activeLeaseQuery).exec(),
      ]).then(([applicationCount, assignedCount]) => applicationCount + assignedCount);

      const totalPropertiesPromise = this.propertyModel
        .countDocuments({ createdBy: id })
        .exec();

      const totalNewLastMonthPromise = this.applicationModel
        .countDocuments({ ownerId: id, status: 'New', createdAt: { $lt: startOfThisMonth } })
        .exec();
      const totalAcceptedLastMonthPromise = this.applicationModel
        .countDocuments({ ownerId: id, status: 'Accepted', createdAt: { $lt: startOfThisMonth } })
        .exec();
      const totalPropertiesLastMonthPromise = this.propertyModel
        .countDocuments({ createdBy: id, createdAt: { $lt: startOfThisMonth } })
        .exec();

      const activeTenantsLastMonthQuery = {
        ownerId: id,
        status: ApplicationStatus.ACTIVE_LEASE,
        rentStartDate: { $lte: endOfLastMonth },
        $or: [
          { rentEndDate: { $gte: endOfLastMonth } },
          { rentEndDate: null },
        ],
      };
      const totalActiveTenantsLastMonthPromise = Promise.all([
        this.applicationModel.countDocuments(activeTenantsLastMonthQuery).exec(),
        this.landlordAssignedTenantModel.countDocuments(activeTenantsLastMonthQuery).exec(),
      ]).then(([a, b]) => a + b);

      const [totalNew, totalAccepted, totalActiveTenants, totalProperties, totalNewLastMonth, totalAcceptedLastMonth, totalPropertiesLastMonth, totalActiveTenantsLastMonth] =
        await Promise.all([
          totalNewPromise,
          totalAcceptedPromise,
          totalActiveTenantsPromise,
          totalPropertiesPromise,
          totalNewLastMonthPromise,
          totalAcceptedLastMonthPromise,
          totalPropertiesLastMonthPromise,
          totalActiveTenantsLastMonthPromise,
        ]);

      return {
        totalNew,
        totalAccepted,
        totalActiveTenants,
        totalProperties,
        totalNewLastMonth,
        totalAcceptedLastMonth,
        totalActiveTenantsLastMonth,
        totalPropertiesLastMonth,
      };
    } catch (error) {
      throw new Error(`Failed to fetch landlord applications: ${error}`);
    }
  }

  async getTenantMetrics(id: any): Promise<
    | {
        totalNew: number;
        totalAccepted: number;
        totalRejected: number;
        totalActiveTenants: number;
        totalRentedApartments: number;
      }
    | any
  > {
    try {
      const totalNewPromise = this.applicationModel
        .countDocuments({ applicant: id, status: 'New' })
        .exec();
      const totalAcceptedPromise = this.applicationModel
        .countDocuments({ applicant: id, status: 'Accepted' })
        .exec();
      const totalRejectedPromise = this.applicationModel
        .countDocuments({ applicant: id, status: ApplicationStatus.REJECTED })
        .exec();
      const totalMaintenancePromise = this.maintenanceModel
        .countDocuments({ createdBy: id })
        .exec();
      const rentedFromApplicationsPromise = this.applicationModel
        .countDocuments({ applicant: id, status: ApplicationStatus.ACTIVE_LEASE })
        .exec();
      const rentedFromAssignedPromise = this.landlordAssignedTenantModel
        .countDocuments({ applicant: id, status: ApplicationStatus.ACTIVE_LEASE })
        .exec();

      const [
        totalNew,
        totalAccepted,
        totalRejected,
        totalMaintenance,
        rentedFromApplications,
        rentedFromAssigned,
      ] = await Promise.all([
        totalNewPromise,
        totalAcceptedPromise,
        totalRejectedPromise,
        totalMaintenancePromise,
        rentedFromApplicationsPromise,
        rentedFromAssignedPromise,
      ]);
      const totalRentedApartments = rentedFromApplications + rentedFromAssigned;
      return {
        totalNew,
        totalAccepted,
        totalRejected,
        totalMaintenance,
        totalActiveTenants: totalMaintenance,
        totalRentedApartments,
      };
    } catch (error) {
      throw new Error(`Failed to fetch tenant metrics: ${error}`);
    }
  }

  private async countLandlordLeaseDocuments(
    landlordId: string,
    query: Record<string, unknown>,
  ): Promise<number> {
    const ownerFilter = { ownerId: landlordId };
    const [applicationCount, assignedCount] = await Promise.all([
      this.applicationModel.countDocuments({ ...ownerFilter, ...query }).exec(),
      this.landlordAssignedTenantModel
        .countDocuments({ ...ownerFilter, ...query })
        .exec(),
    ]);
    return applicationCount + assignedCount;
  }

  private async getLandlordRoomIds(landlordId: string): Promise<string[]> {
    const properties = await this.propertyModel
      .find({ createdBy: landlordId })
      .select('_id')
      .lean()
      .exec();
    const propertyIds = properties.map((property) => property._id);
    if (!propertyIds.length) {
      return [];
    }
    const rooms = await this.roomModel
      .find({ propertyId: { $in: propertyIds } })
      .select('_id')
      .lean()
      .exec();
    return rooms.map((room) => String(room._id));
  }

  private percentChange(current: number, previous: number): number {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }
    return Math.round(((current - previous) / previous) * 100);
  }

  private async getMaintenanceResolutionRate(
    roomIds: string[],
    from: Date,
    to?: Date,
  ): Promise<number | null> {
    if (!roomIds.length) {
      return null;
    }

    const createdAtFilter: Record<string, Date> = { $gte: from };
    if (to) {
      createdAtFilter.$lt = to;
    }

    const records = await this.maintenanceModel
      .find({
        roomId: { $in: roomIds },
        createdAt: createdAtFilter,
      })
      .select('status')
      .lean()
      .exec();

    if (!records.length) {
      return null;
    }

    const resolved = records.filter(
      (record) => record.status === MaintenanceStatus.RESOLVED,
    ).length;

    return Math.round((resolved / records.length) * 100);
  }

  async getLandlordTenantManagementMetrics(landlordId: string): Promise<{
    retentionRate: number;
    retentionRateChange: number;
    rentCollectionRate: number;
    rentCollectionRateChange: number;
    complaintResolutionRate: number | null;
    complaintResolutionRateChange: number | null;
    tenantSatisfactionScore: number | null;
    tenantSatisfactionChange: number | null;
  }> {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const activeStatus = ApplicationStatus.ACTIVE_LEASE;
    const endedStatus = ApplicationStatus.ENDED;

    const countActiveAt = async (at: Date) => {
      return this.countLandlordLeaseDocuments(landlordId, {
        status: activeStatus,
        rentStartDate: { $lte: at },
        $or: [{ rentEndDate: null }, { rentEndDate: { $gte: at } }],
      });
    };

    const [activeNow, endedLeases, activeSixMonthsAgo, currentRentLeases, rentLeasesSixMonthsAgo] =
      await Promise.all([
        this.countLandlordLeaseDocuments(landlordId, { status: activeStatus }),
        this.countLandlordLeaseDocuments(landlordId, { status: endedStatus }),
        countActiveAt(sixMonthsAgo),
        this.countLandlordLeaseDocuments(landlordId, {
          status: activeStatus,
          rentStartDate: { $lte: now },
          $or: [{ rentEndDate: null }, { rentEndDate: { $gte: now } }],
        }),
        this.countLandlordLeaseDocuments(landlordId, {
          status: activeStatus,
          rentStartDate: { $lte: sixMonthsAgo },
          $or: [{ rentEndDate: null }, { rentEndDate: { $gte: sixMonthsAgo } }],
        }),
      ]);

    const retentionDenominator = activeNow + endedLeases;
    const retentionRate =
      retentionDenominator === 0
        ? 0
        : Math.round((activeNow / retentionDenominator) * 100);
    const retentionRateChange = this.percentChange(activeNow, activeSixMonthsAgo);

    const rentCollectionRate =
      activeNow === 0 ? 0 : Math.round((currentRentLeases / activeNow) * 100);
    const priorRentCollectionRate =
      activeSixMonthsAgo === 0
        ? 0
        : Math.round((rentLeasesSixMonthsAgo / activeSixMonthsAgo) * 100);
    const rentCollectionRateChange =
      rentCollectionRate - priorRentCollectionRate;

    const roomIds = await this.getLandlordRoomIds(landlordId);
    const [complaintResolutionRate, priorComplaintResolutionRate] =
      await Promise.all([
        this.getMaintenanceResolutionRate(roomIds, sixMonthsAgo),
        this.getMaintenanceResolutionRate(roomIds, twelveMonthsAgo, sixMonthsAgo),
      ]);

    const complaintResolutionRateChange =
      complaintResolutionRate === null || priorComplaintResolutionRate === null
        ? null
        : complaintResolutionRate - priorComplaintResolutionRate;

    return {
      retentionRate,
      retentionRateChange,
      rentCollectionRate,
      rentCollectionRateChange,
      complaintResolutionRate,
      complaintResolutionRateChange,
      tenantSatisfactionScore: null,
      tenantSatisfactionChange: null,
    };
  }

  async isPropertyMappedToActiveTenant(propertyId: string): Promise<boolean> {
    try {
      const existingMapping = await this.landlordAssignedTenantModel.findOne({
        propertyId: propertyId,
        status: 'Active_lease',
      });
      const doesActiveTenantExist = await this.applicationModel.findOne({
        propertyId: propertyId,
        status: 'Active_lease',
      });

      if (doesActiveTenantExist) {
        throw new BadRequestException(
          'This property/apartment has an active tenant',
        );
      }
      return !!existingMapping;
    } catch (error) {
      console.error(`Failed to check property mapping: ${error.message}`);
      throw new Error(`Failed to check property mapping: ${error.message}`);
    }
  }

  async mapCreatedUserToApartment(payload: any): Promise<any> {
    try {
      const { propertyId } = payload;
      if (!propertyId) {
        throw new BadRequestException(
          'propertyId is required to map a tenant to an apartment.',
        );
      }
      const isMapped = await this.isPropertyMappedToActiveTenant(propertyId);

      if (isMapped) {
        throw new Error(
          `The propertyId ${propertyId} is already mapped to an active tenant.`,
        );
      }
      const newApplication =
        await this.landlordAssignedTenantModel.create({...payload, status: ApplicationStatus.ACTIVE_LEASE});
        await this.roomModel.updateOne(  { _id: propertyId },
          { $set: { assignedToTenant: true, listRoom: false } })
      return newApplication;
    } catch (error) {
      throw new Error(`Failed to map user to this apartment: ${error.message}`);
    }
  }

  async findLandlordOnboardedTenants(id: any, status?: string): Promise<any> {
    const now = new Date();
    const ownerFilter = this.ownerIdMatch(id);
    const lower = status?.trim()?.toLowerCase();

    if (lower === 'ended' || lower === 'past') {
      return await this.landlordAssignedTenantModel
        .find({
          ...ownerFilter,
          $or: [
            { status: { $in: [ApplicationStatus.ENDED, 'ended', 'ENDED'] } },
            { rentEndDate: { $lt: now } },
          ],
        })
        .sort({ updatedAt: -1, createdAt: -1 })
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: { path: 'propertyId' },
        })
        .populate('applicant');
    }

    if (lower === 'active' || lower === 'active_lease' || status === 'Accepted') {
      return await this.landlordAssignedTenantModel
        .find({
          ...ownerFilter,
          status: {
            $in: [ApplicationStatus.ACTIVE_LEASE, 'active', 'Accepted'],
          },
        })
        .sort({ updatedAt: -1, createdAt: -1 })
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: { path: 'propertyId' },
        })
        .populate('applicant');
    }

    return await this.landlordAssignedTenantModel
      .find({
        ...ownerFilter,
        ...(status ? { status } : {}),
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate('ownerId')
      .populate({
        path: 'propertyId',
        populate: { path: 'propertyId' },
      })
      .populate('applicant');
  }
  

  async findTenantHistory(nin: string, userId: any): Promise<any> {
    const user = await this.userModel.findOne({ nin: nin });
    if (!user) {
      return null;
    }

    const owner = await this.userModel.findOne({ _id: userId });
    if (owner) {
      const historyExists = owner.tenantVerficationHistory.some(
        (history: any) => history.nin.includes(nin),
      );

      if (!historyExists) {
        const verificationHistory = {
          timestamp: new Date(),
          details: `Tenant with NIN ${nin} has been verified by ${owner.firstName} ${owner.lastName}`,
          nin: nin,
        };

        owner.tenantVerficationHistory.push(verificationHistory);
        await owner.save();
      }

      const tenants = await this.landlordAssignedTenantModel
        .find({ applicant: user._id })
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: {
            path: 'propertyId',
          },
        })
        .populate('applicant');
      return tenants;
    }
    return null;
  }

  async uploadAgreementDocuments(body: any) {
    try {
      console.log({ body });

      // Check if an unsigned document already exists for the applicant
      if (body.unsignedDocument && body.unsignedDocument.length > 0) {
        const existingUnsignedDocument =
          await this.agreementDocumentsModel.findOne({
            applicant: body.applicant,
            status: 'Unsigned',
          });
        if (existingUnsignedDocument) {
          throw new Error(
            'An unsigned agreement document for this applicant already exists.',
          );
        }
      }

      // Handle uploading of the unsigned document if present
      let unsignedDocument = null;
      if (body.unsignedDocument && body.unsignedDocument.length > 0) {
        unsignedDocument = await this.cloudinaryService.upload(
          body.unsignedDocument[0],
        );
        if (!unsignedDocument) {
          throw new Error('Failed to upload unsigned document.');
        }
      }

      // Handle uploading of the signed document if present
      let signedDocument = null;
      if (body.signedDocument && body.signedDocument.length > 0) {
        signedDocument = await this.cloudinaryService.upload(
          body.signedDocument[0],
        );
        if (!signedDocument) {
          throw new Error('Failed to upload signed document.');
        }

        // If an existing document exists, update it with the signed document
        const existingDocument = await this.agreementDocumentsModel.findOne({
          applicant: body.applicant,
        });

        if (existingDocument) {
          // Update existing document with the signed document
          existingDocument.signedDocument = signedDocument;
          existingDocument.status = 'Signed'; // Update the status to 'Signed'
          await existingDocument.save(); // Save the updated document
          return existingDocument; // Return the updated document
        }
      }

      // If no signed document exists, create a new document
      const data = {
        propertyId: body.propertyId,
        ownerId: body.ownerId,
        applicant: body.applicant,
        status: unsignedDocument ? 'Unsigned' : 'Signed', // Set status based on document type
        unsignedDocument,
        signedDocument,
      };

      // Create a new agreement document if no update was performed
      const newAgreementDocuments =
        await this.agreementDocumentsModel.create(data);
      return newAgreementDocuments;
    } catch (error) {
      throw new Error(
        `Failed to create or update agreement document: ${error.message}`,
      );
    }
  }

  async getLandlordApplicationsById(
    page: number = 1,
    limit: number = 10,
    id: any,
    status: string,
  ): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      let query = this.applicationModel.find({ ownerId: id });
      if (status) {
        query = query.where('status').equals(status);
      }

      const applications = await query
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: {
            path: 'propertyId',
          },
        })
        .populate('applicant')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      return applications;
    } catch (error) {
      throw new Error(`Failed to fetch landlord applications: ${error}`);
    }
  }

  private hydrateApplicationEmploymentFields(application: any): any {
    if (!application) {
      return application;
    }
    const obj = typeof application.toObject === 'function'
      ? application.toObject()
      : { ...application };
    const applicant = obj.applicant && typeof obj.applicant === 'object'
      ? obj.applicant
      : {};
    if (!obj.jobTitle && applicant.jobTitle) {
      obj.jobTitle = applicant.jobTitle;
    }
    if (!obj.currentEmployer && applicant.currentEmployer) {
      obj.currentEmployer = applicant.currentEmployer;
    }
    if (
      obj.monthlyIncome == null &&
      applicant.monthlyIncome != null &&
      applicant.monthlyIncome !== ''
    ) {
      const parsed = Number(applicant.monthlyIncome);
      obj.monthlyIncome = Number.isNaN(parsed)
        ? applicant.monthlyIncome
        : parsed;
    }
    if (!obj.currentResidence) {
      obj.currentResidence =
        obj.currentAddress || applicant.homeAddress || obj.currentResidence;
    }
    return obj;
  }

  async getLandlordApplicationById(applicationId: string): Promise<any> {
    try {
      const application = await this.applicationModel
        .findById(applicationId)
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: {
            path: 'propertyId',
          },
        })
        .populate('applicant')
        .exec();
  
      if (!application) {
        const assigned = await this.landlordAssignedTenantModel
        .findById(applicationId)
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: {
            path: 'propertyId',
          },
        })
        .populate('applicant')
        .exec();

        return this.hydrateApplicationEmploymentFields(assigned);
      }
  
      return this.hydrateApplicationEmploymentFields(application);
    } catch (error) {
      throw new Error(`Failed to fetch landlord application: ${error.message}`);
    }
  }

  /**
   * Returns average annual rent by Lagos neighborhood (grouped by `Property.city`).
   * Note: the optional `year` filter uses `Room.createdAt` as the time bucket.
   */
  async getRentHeatmap(params: {
    state?: string;
    year?: number;
    includeAllListings?: boolean;
  }): Promise<{
    state: string;
    year?: number;
    areas: Array<{
      city: string;
      avgAnnualRent: number;
      listingsCount: number;
    }>;
    minAvgAnnualRent: number;
    maxAvgAnnualRent: number;
  }> {
    const state = String(params?.state || 'Lagos').trim() || 'Lagos';
    const year = params?.year;
    const includeAllListings = params?.includeAllListings === true;
    const yearNum =
      year === undefined || year === null || Number.isNaN(Number(year))
        ? undefined
        : Number(year);

    const match: any = includeAllListings
      ? {
          rentAmount: { $exists: true, $ne: null },
        }
      : {
          listRoom: true,
          approved: true,
          assignedToTenant: false,
          rentAmount: { $exists: true, $ne: null },
        };

    if (yearNum !== undefined) {
      const start = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0));
      const end = new Date(Date.UTC(yearNum + 1, 0, 1, 0, 0, 0));
      match.createdAt = { $gte: start, $lt: end };
    }

    const stateRegex = new RegExp(`^${state}\\s*$`, 'i');

    const areas = await this.roomModel
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            as: 'property',
          },
        },
        { $unwind: '$property' },
        {
          $match: {
            'property.state': stateRegex,
            'property.status': { $nin: ['inactive', 'deleted'] },
          },
        },
        {
          $match: {
            'property.city': { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: '$property.city',
            avgAnnualRent: { $avg: '$rentAmount' },
            listingsCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            city: '$_id',
            avgAnnualRent: { $round: ['$avgAnnualRent', 0] },
            listingsCount: 1,
          },
        },
        { $sort: { avgAnnualRent: -1 } },
      ])
      .exec();

    const safeAreas: Array<{
      city: string;
      avgAnnualRent: number;
      listingsCount: number;
    }> = Array.isArray(areas) ? areas : [];

    const avgValues = safeAreas.map((a) => a.avgAnnualRent).filter((n) => Number.isFinite(n));
    const minAvgAnnualRent = avgValues.length ? Math.min(...avgValues) : 0;
    const maxAvgAnnualRent = avgValues.length ? Math.max(...avgValues) : 0;

    return {
      state,
      year: yearNum,
      areas: safeAreas,
      minAvgAnnualRent,
      maxAvgAnnualRent,
    };
  }

  async getRentHeatmapInsights(params: {
    state?: string;
    year?: number;
    includeAllListings?: boolean;
  }): Promise<{
    state: string;
    year?: number;
    generatedAt: string;
    provider: 'gemini' | 'fallback';
    summary: string;
    bullets: string[];
    disclaimer: string;
    metadata: {
      totalAreas: number;
      totalListings: number;
      medianAreaAvgRent: number;
      weightedAverageRent: number;
      minAvgRent: number;
      maxAvgRent: number;
      spreadPercent: number;
    };
    marketSegments: {
      premium: string[];
      midMarket: string[];
      valueAreas: string[];
    };
    areaInsights: Array<{
      city: string;
      avgAnnualRent: number;
      listingsCount: number;
      shareOfListingsPercent: number;
      relativeToStateAveragePercent: number;
      affordabilityBand: 'premium' | 'mid-market' | 'value';
    }>;
    aiNarrative: {
      headline: string;
      demandSignals: string[];
      opportunities: string[];
      riskNotes: string[];
    };
    aiDebug?: {
      providerTried: 'gemini';
      lastErrorMessage?: string;
    };
  }> {
    const heatmap = await this.getRentHeatmap({
      ...params,
      includeAllListings: params.includeAllListings ?? true,
    });
    const generatedAt = new Date().toISOString();

    const top = heatmap.areas.slice(0, 5);
    const bottom = heatmap.areas.slice(-5).reverse();
    const totalListings = heatmap.areas.reduce(
      (acc, area) => acc + (Number(area.listingsCount) || 0),
      0,
    );

    const weightedAverageRent = totalListings
      ? Math.round(
          heatmap.areas.reduce(
            (acc, area) =>
              acc + (Number(area.avgAnnualRent) || 0) * (Number(area.listingsCount) || 0),
            0,
          ) / totalListings,
        )
      : 0;

    const sortedRents = heatmap.areas
      .map((a) => Number(a.avgAnnualRent) || 0)
      .sort((a, b) => a - b);
    const medianAreaAvgRent =
      sortedRents.length === 0
        ? 0
        : sortedRents.length % 2 === 1
          ? sortedRents[Math.floor(sortedRents.length / 2)]
          : Math.round(
              (sortedRents[sortedRents.length / 2 - 1] + sortedRents[sortedRents.length / 2]) / 2,
            );

    const spreadPercent =
      weightedAverageRent > 0
        ? Math.round(
            ((heatmap.maxAvgAnnualRent - heatmap.minAvgAnnualRent) / weightedAverageRent) * 100,
          )
        : 0;

    const fallbackDisclaimer =
      'AI-generated insights based on aggregated listing data. Estimates are indicative; actual rent varies by property condition, amenities, building age, and street location.';

    const buildAreaInsights = () =>
      heatmap.areas.map((area) => {
        const avg = Number(area.avgAnnualRent) || 0;
        const listings = Number(area.listingsCount) || 0;
        const shareOfListingsPercent = totalListings
          ? Math.round((listings / totalListings) * 100)
          : 0;
        const relativeToStateAveragePercent = weightedAverageRent
          ? Math.round(((avg - weightedAverageRent) / weightedAverageRent) * 100)
          : 0;
        const affordabilityBand: 'premium' | 'mid-market' | 'value' =
          avg >= weightedAverageRent * 1.2
            ? 'premium'
            : avg <= weightedAverageRent * 0.85
              ? 'value'
              : 'mid-market';

        return {
          city: area.city,
          avgAnnualRent: avg,
          listingsCount: listings,
          shareOfListingsPercent,
          relativeToStateAveragePercent,
          affordabilityBand,
        };
      });

    const areaInsights = buildAreaInsights();
    const marketSegments = {
      premium: areaInsights
        .filter((a) => a.affordabilityBand === 'premium')
        .slice(0, 6)
        .map((a) => a.city),
      midMarket: areaInsights
        .filter((a) => a.affordabilityBand === 'mid-market')
        .slice(0, 6)
        .map((a) => a.city),
      valueAreas: areaInsights
        .filter((a) => a.affordabilityBand === 'value')
        .slice(0, 6)
        .map((a) => a.city),
    };

    const fallback = (): {
      provider: 'fallback';
      summary: string;
      bullets: string[];
      disclaimer: string;
      aiNarrative: {
        headline: string;
        demandSignals: string[];
        opportunities: string[];
        riskNotes: string[];
      };
    } => {
      const summary = `Across ${heatmap.state}, average annual rent varies widely by area. The highest-priced areas are typically concentrated in premium neighborhoods, while more affordable options appear in outer/local districts.`;
      const bullets: string[] = [
        top[0]
          ? `Most expensive area: ${top[0].city} (~₦${Number(top[0].avgAnnualRent).toLocaleString()}/yr, ${top[0].listingsCount} listings).`
          : 'Most expensive area: not enough listings yet.',
        bottom[0]
          ? `Most affordable area: ${bottom[0].city} (~₦${Number(bottom[0].avgAnnualRent).toLocaleString()}/yr, ${bottom[0].listingsCount} listings).`
          : 'Most affordable area: not enough listings yet.',
        `Shown areas: ${heatmap.areas.length}. Filter by year to view recent listing patterns.`,
      ];

      return {
        provider: 'fallback',
        summary,
        bullets,
        disclaimer: fallbackDisclaimer,
        aiNarrative: {
          headline: `${heatmap.state} rent market snapshot`,
          demandSignals: [
            top[0]
              ? `${top[0].city} leads premium pricing; likely high demand for prime locations.`
              : 'Premium-demand signal unavailable due to low data volume.',
            `Market spread is about ${spreadPercent}% between lowest and highest area averages.`,
          ],
          opportunities: [
            bottom[0]
              ? `${bottom[0].city} stands out as a value area for cost-sensitive renters.`
              : 'Value-area opportunities currently limited by low listings.',
            'Use area + year filters to identify neighborhoods with stable average rents.',
          ],
          riskNotes: [
            'Averages may hide street-level variations and property quality differences.',
            'Low listing counts can reduce reliability for some neighborhoods.',
          ],
        },
      };
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      const fb = fallback();
      return {
        ...heatmap,
        generatedAt,
        ...fb,
        metadata: {
          totalAreas: heatmap.areas.length,
          totalListings,
          medianAreaAvgRent,
          weightedAverageRent,
          minAvgRent: heatmap.minAvgAnnualRent,
          maxAvgRent: heatmap.maxAvgAnnualRent,
          spreadPercent,
        },
        marketSegments,
        areaInsights,
      };
    }

    const configuredModel = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    const modelCandidates = Array.from(
      new Set([
        configuredModel,
        'gemini-2.0-flash',
        'gemini-flash-latest',
        'gemini-2.5-flash',
      ]),
    ).filter(Boolean);

    const prompt = {
      state: heatmap.state,
      year: heatmap.year ?? null,
      areas_count: heatmap.areas.length,
      min_avg_annual_rent: heatmap.minAvgAnnualRent,
      max_avg_annual_rent: heatmap.maxAvgAnnualRent,
      top_5: top,
      bottom_5: bottom,
      notes: [
        'These are aggregated averages from approved, publicly listed, unoccupied units.',
        'Write insights for Nigerian renters/landlords; keep it practical and cautious.',
        'Return JSON with keys: summary, bullets, disclaimer, aiNarrative where aiNarrative has: headline, demandSignals[], opportunities[], riskNotes[].',
      ],
    };

    let lastGeminiError: string | undefined;
    try {
      let res: any = null;
      let lastError: any = null;
      for (const candidate of modelCandidates) {
        try {
          res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
              candidate,
            )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
            {
              generationConfig: {
                temperature: 0.4,
                responseMimeType: 'application/json',
              },
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text:
                        'You generate short, safe property rent market insights. Return ONLY valid JSON with keys: summary (string), bullets (string[]), disclaimer (string), aiNarrative (object with headline, demandSignals, opportunities, riskNotes). No markdown.',
                    },
                    {
                      text: `Generate AI-powered rent insights from this aggregated dataset:\n${JSON.stringify(
                        prompt,
                      )}`,
                    },
                  ],
                },
              ],
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 12000,
            },
          );
          if (res) break;
        } catch (err: any) {
          lastError = err;
        }
      }
      if (!res) {
        lastGeminiError = lastError?.message || 'Gemini request failed';
        throw lastError || new Error('Gemini request failed');
      }

      const content = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = content ? JSON.parse(content) : null;

      const summary =
        typeof parsed?.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : fallback().summary;
      const bullets =
        Array.isArray(parsed?.bullets) && parsed.bullets.every((b: any) => typeof b === 'string')
          ? parsed.bullets.map((b: string) => b.trim()).filter(Boolean).slice(0, 6)
          : fallback().bullets;
      const disclaimer =
        typeof parsed?.disclaimer === 'string' && parsed.disclaimer.trim()
          ? parsed.disclaimer.trim()
          : fallbackDisclaimer;
      const fallbackNarrative = fallback().aiNarrative;
      const aiNarrative = {
        headline:
          typeof parsed?.aiNarrative?.headline === 'string' &&
          parsed.aiNarrative.headline.trim()
            ? parsed.aiNarrative.headline.trim()
            : fallbackNarrative.headline,
        demandSignals:
          Array.isArray(parsed?.aiNarrative?.demandSignals) &&
          parsed.aiNarrative.demandSignals.every((x: any) => typeof x === 'string')
            ? parsed.aiNarrative.demandSignals.map((x: string) => x.trim()).filter(Boolean).slice(0, 5)
            : fallbackNarrative.demandSignals,
        opportunities:
          Array.isArray(parsed?.aiNarrative?.opportunities) &&
          parsed.aiNarrative.opportunities.every((x: any) => typeof x === 'string')
            ? parsed.aiNarrative.opportunities.map((x: string) => x.trim()).filter(Boolean).slice(0, 5)
            : fallbackNarrative.opportunities,
        riskNotes:
          Array.isArray(parsed?.aiNarrative?.riskNotes) &&
          parsed.aiNarrative.riskNotes.every((x: any) => typeof x === 'string')
            ? parsed.aiNarrative.riskNotes.map((x: string) => x.trim()).filter(Boolean).slice(0, 5)
            : fallbackNarrative.riskNotes,
      };

      return {
        ...heatmap,
        generatedAt,
        provider: 'gemini',
        summary,
        bullets,
        disclaimer,
        metadata: {
          totalAreas: heatmap.areas.length,
          totalListings,
          medianAreaAvgRent,
          weightedAverageRent,
          minAvgRent: heatmap.minAvgAnnualRent,
          maxAvgRent: heatmap.maxAvgAnnualRent,
          spreadPercent,
        },
        marketSegments,
        areaInsights,
        aiNarrative,
      };
    } catch (err: any) {
      const fb = fallback();
      return {
        ...heatmap,
        generatedAt,
        ...fb,
        metadata: {
          totalAreas: heatmap.areas.length,
          totalListings,
          medianAreaAvgRent,
          weightedAverageRent,
          minAvgRent: heatmap.minAvgAnnualRent,
          maxAvgRent: heatmap.maxAvgAnnualRent,
          spreadPercent,
        },
        marketSegments,
        areaInsights,
        aiDebug: {
          providerTried: 'gemini',
          lastErrorMessage: err?.message || lastGeminiError,
        },
      };
    }
  }
  
}
