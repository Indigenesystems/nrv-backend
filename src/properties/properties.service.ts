import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { Property } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';
import { Application, ApplicationStatus } from './entities/application.entity';
import { EmailService } from '../email-sender/email.service';
import { LandlordAssignedTenant } from './entities/landlord_assigned_tenant.entity';
import { User } from '../users/entities/user.entity';
import { Maintenance } from 'src/maintenance/entities/maintenance.entity';
import { AgreementDocuments } from './entities/agreement_documents.entity';
import { Room } from 'src/rooms/entities/room.entity';
import { randomInt } from 'crypto';

import { populate } from 'dotenv';
import { ActivitiesService } from '../activities/activities.service';
import { PlansService } from '../plans/plans.service';

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
  ) {}

  async createProperty(createPropertyDto: any) {
    const createdByUserId = createPropertyDto.createdBy;
    const user = await this.userModel.findById(createdByUserId).lean();
    if (!user) {
      throw new BadRequestException('User not found');
    }
    // Properties can be added without purchasing credits; no limit enforced.

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
      streetAddress: createPropertyDto.location,
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

          return this.roomModel.create({
            ...room,
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

    const singleProperty = await this.findPropertyById(
      updatePropertyDto?.query,
    );

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

    // Upload multiple images
    if (updatePropertyDto.images && updatePropertyDto.images.length > 0) {
      imageUrls = await Promise.all(
        updatePropertyDto.images.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );

      singleProperty.imageUrls.push(...imageUrls);
    }

    // Upload/replace main property image (file)
    if (updatePropertyDto.file) {
      const fileToUpload = Array.isArray(updatePropertyDto.file)
        ? updatePropertyDto.file[0]
        : updatePropertyDto.file;
      if (fileToUpload) {
        singleProperty.file = await this.cloudinaryService.upload(fileToUpload);
      }
    }

    // Update other properties
    if (updatePropertyDto.unit) {
      singleProperty.unit = updatePropertyDto.unit;
    }
    if (updatePropertyDto.city) {
      singleProperty.city = updatePropertyDto.city;
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

    // Update the property in the database
    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      updatePropertyDto?.query,
      singleProperty,
      { new: true, runValidators: true },
    );

    return updatedProperty;
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
      this.propertyModel.countDocuments({ createdBy: userId }),
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
  async findAllPropertyWithPagination(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    propertyType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number } }> {
    const { page, limit, search, status, propertyType, sortBy, sortOrder } = params;
    
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
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Property type filter
    if (propertyType) {
      query.propertyType = propertyType;
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
      otherDocuments: property.otherDocuments,
      utilityAndMaintenance: property.utilityAndMaintenance,
      landlordInsurancePolicy: property.landlordInsurancePolicy,
      propertyType: property.propertyType,
      file: property.file,
      createdBy: property.createdBy,
      preferredTenants: property.preferredTenants || [],
      rentCollection: property.rentCollection || { value: '', label: '' },
      rooms,
      apartments: rooms,
      apartmentCount: rooms.length,
      //propertyId: property.propertyId,
      unitsLeft: rooms.filter((room: any) => !room.assignedToTenant).length,
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
    if (propertyToDelete) {
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
    }

    const deletedProperty: any = await this.propertyModel.findByIdAndDelete({
      _id: id,
    });
    const deletedRooms: any = await this.roomService.deleteRoomByPropertyId(id);
    return deletedProperty;
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
    const applicationData = {
      propertyId: body.propertyId,
      ownerId: body.ownerId,
      applicant: body.applicant,
      status: body.status,
      identificationCard: fileUrl || null,
      currentEmployer: body.currentEmployer,
      reasonForLiving: body.reasonForLiving,
      jobTitle: body.jobTitle,
      currentResidence: body.currentResidence,
      monthlyIncome: body.monthlyIncome,
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

        if (applicant?.email) {
          await this.emailService.sendPropertyApplicationConfirmationToApplicant({
            applicantEmail: applicant.email,
            applicantName,
            propertyTitle,
            propertyLocation,
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

  async getLandlordApplications(
    page: number = 1,
    limit: number = 10,
    id: any,
    status?: string
  ): Promise<any> {
    try {
      const now = new Date();
      const skip = (page - 1) * limit;
      const prefetchLimit = Math.max(1, page) * limit;
  
      // Format and normalize status
      let formattedStatus = status?.trim() || null;
      if (formattedStatus?.toLowerCase() === 'active_lease') {
        formattedStatus = 'Active_lease';
      }
      if (formattedStatus?.toLowerCase() === 'ended') {
        formattedStatus = ApplicationStatus.ENDED;
      }
  
      // Build query filters
      const buildQuery = () => {
        const query: any = { ownerId: id };
        if (formattedStatus === ApplicationStatus.ENDED) {
          query.status = ApplicationStatus.ENDED;
        } else if (formattedStatus) {
          query.status = formattedStatus;
        }
        return query;
      };
  
      const query = buildQuery();
  
      // Run both queries in parallel
      const [applications, onboardedTenants] = await Promise.all([
        this.applicationModel
          .find(query)
          .sort({ createdAt: -1 })
          .limit(prefetchLimit)
          .populate('ownerId')
          .populate({ path: 'propertyId', populate: { path: 'propertyId' } })
          .populate('applicant'),
  
        this.landlordAssignedTenantModel
          .find(query)
          .sort({ createdAt: -1 })
          .limit(prefetchLimit)
          .populate('ownerId')
          .populate({ path: 'propertyId', populate: { path: 'propertyId' } })
          .populate('applicant'),
      ]);
  
      // Combine and return results
      const combined = [...applications, ...onboardedTenants]
        .sort((a: any, b: any) => {
          const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
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
      let query = this.applicationModel.find({ applicant: id });

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

      // Notify applicant of status change (best-effort)
      try {
        const hydrated = await this.applicationModel
          .findById(saved._id)
          .populate('applicant')
          .populate('ownerId')
          .populate({ path: 'propertyId', populate: { path: 'propertyId' } })
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

        if (applicant?.email && previousStatus !== newStatus) {
          await this.emailService.sendApplicationStatusUpdateToApplicant({
            applicantEmail: applicant.email,
            applicantName,
            status: newStatus,
            propertyTitle,
            propertyLocation,
          });
        }
      } catch (err: any) {
        console.error(
          '[PropertiesService] Status update email notification failed:',
          err?.message || err,
        );
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

      const x = await this.findLandlordOnboardedTenants(id);
      const totalActiveTenantsPromise = this.applicationModel
        .countDocuments({ ownerId: id, status: 'Accepted' })
        .exec();

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

      const totalActiveTenantsCount = totalActiveTenants + x.length;

      return {
        totalNew,
        totalAccepted,
        totalActiveTenants: totalActiveTenantsCount,
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
        totalActiveTenants,
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
        totalActiveTenants,
        totalRentedApartments,
      };
    } catch (error) {
      throw new Error(`Failed to fetch tenant metrics: ${error}`);
    }
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
    let formattedStatus = status === 'Accepted' ? 'active' : status;
    if (formattedStatus === 'ended') {
      // Rent has already ended
      return await this.landlordAssignedTenantModel
        .find({
          ownerId: id,
          rentEndDate: { $lt: now },
        })
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: { path: 'propertyId' },
        })
        .populate('applicant');
    }
    if (formattedStatus === 'active') {
      // Currently active leases
      return await this.landlordAssignedTenantModel
        .find({
          ownerId: id,
          status: { $in: ['active', 'Accepted'] },
          rentStartDate: { $lte: now },
          rentEndDate: { $gte: now },
        })
        .populate('ownerId')
        .populate({
          path: 'propertyId',
          populate: { path: 'propertyId' },
        })
        .populate('applicant');
    }
    
  
    // Generic fallback for other statuses (e.g., pending, rejected)
    return await this.landlordAssignedTenantModel
      .find({
        ownerId: id,
        ...(formattedStatus ? { status: formattedStatus } : {}),
      })
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
        const application = await this.landlordAssignedTenantModel
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

        return application
      }
  
      return application;
    } catch (error) {
      throw new Error(`Failed to fetch landlord application: ${error.message}`);
    }
  }
  
}
