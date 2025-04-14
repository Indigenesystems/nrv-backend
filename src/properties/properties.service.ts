import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { Property } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';
import { Application } from './entities/application.entity';
import { EmailService } from '../email-sender/email.service';
import { LandlordAssignedTenant } from './entities/landlord_assigned_tenant.entity';
import { User } from '../users/entities/user.entity';
import { Maintenance } from 'src/maintenance/entities/maintenance.entity';
import { AgreementDocuments } from './entities/agreement_documents.entity';
import { Room } from 'src/rooms/entities/room.entity';
import { randomInt } from 'crypto';



@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Maintenance.name) private readonly maintenanceModel : Model<Maintenance>,
    @InjectModel(Application.name) private readonly applicationModel: Model<Application>,
    @InjectModel(AgreementDocuments.name) private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    @InjectModel(LandlordAssignedTenant.name) private readonly landlordAssignedTenantModel: Model<LandlordAssignedTenant>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
    private roomService: RoomsService,
    private emailService: EmailService, 
  ) { }

  async createProperty(createPropertyDto: any) {
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
        createPropertyDto.landlordInsurancePolicy.map(async (file: Express.Multer.File) =>
          this.cloudinaryService.upload(file),
        ),
      );
    }
  
    if (createPropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        createPropertyDto.utilityAndMaintenance.map(async (file: Express.Multer.File) =>
          this.cloudinaryService.upload(file),
        ),
      );
    }
  
    if (createPropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        createPropertyDto.otherDocuments.map(async (file: Express.Multer.File) =>
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
      zipCode: createPropertyDto.zipCode,
      propertyType: createPropertyDto.propertyType,
      createdBy: createPropertyDto.createdBy,
      landlordInsurancePolicy: landlordInsurancePolicyUrls,
      utilityAndMaintenance: utilityAndMaintenanceUrls,
      otherDocuments: otherDocumentsUrls,
      preferredTenants: createPropertyDto.preferredTenants || [],
      propertyName: createPropertyDto.propertyName || '',
      rentCollection: createPropertyDto.rentCollection || { value: '', label: '' },
    };
  
    const newProperty = new this.propertyModel(propertyData);
    const createdProperty = await newProperty.save();

    if (createPropertyDto.units && createPropertyDto.units.length > 0) {
      const roomDocs = await Promise.all(
      JSON.parse(createPropertyDto.units).map((room: any) =>
          this.roomModel.create({
            ...room,
            roomId: randomInt(10000000),
            propertyId: createdProperty._id,
          }),
        ),
      );
  
      // Update property with linked rooms
      createdProperty.rooms = roomDocs.map((room) => room._id);
      await createdProperty.save();
    }
  
    return createdProperty;
  }
  

  async updateProperty(updatePropertyDto: any) {
    
    let landlordInsurancePolicyUrls: any = [];
    let utilityAndMaintenanceUrls: any = [];
    let otherDocumentsUrls: any = [];
    
    const singleProperty = await this.findPropertyById(updatePropertyDto?.query);
 
    // Ensure properties are arrays to avoid "not iterable" errors
    singleProperty.landlordInsurancePolicy = singleProperty.landlordInsurancePolicy || [];
    singleProperty.utilityAndMaintenance = singleProperty.utilityAndMaintenance || [];
    singleProperty.otherDocuments = singleProperty.otherDocuments || [];
  
    // Upload landlord insurance policies
    if (updatePropertyDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        updatePropertyDto.landlordInsurancePolicy.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        }),
      );

      singleProperty.landlordInsurancePolicy.push(...landlordInsurancePolicyUrls);

    }
  
    // Upload utility and maintenance documents
    if (updatePropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        updatePropertyDto.utilityAndMaintenance.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        }),
      );
  
      singleProperty.utilityAndMaintenance.push(...utilityAndMaintenanceUrls);
    }
  
    // Upload other documents
    if (updatePropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        updatePropertyDto.otherDocuments.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        }),
      );
  
      singleProperty.otherDocuments.push(...otherDocumentsUrls);
    }
  
    // Update other properties
    if (updatePropertyDto.unit) {
      singleProperty.unit = updatePropertyDto.unit;
    }
    if (updatePropertyDto.city) {
      singleProperty.city = updatePropertyDto.city;
    }
    if (updatePropertyDto.propertyType) {
      singleProperty.propertyType = updatePropertyDto.propertyType;
    }
    if (updatePropertyDto.streetAddress) {
      singleProperty.streetAddress = updatePropertyDto.streetAddress;
    }
    if (updatePropertyDto.state) {
      singleProperty.state = updatePropertyDto.state;
    }
    if (updatePropertyDto.zipCode) {
      singleProperty.zipCode = updatePropertyDto.zipCode;
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
        unitsLeft: filteredRooms.filter((room) => !room.assignedToTenant).length,
      };
    });
  
    return filteredProperties;
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
      zipCode: property.zipCode,
      otherDocuments: property.otherDocuments,
      utilityAndMaintenance: property.utilityAndMaintenance,
      landlordInsurancePolicy: property.landlordInsurancePolicy,
      propertyType: property.propertyType,
      file: property.file,
      createdBy: property.createdBy,
      preferredTenants: property.preferredTenants || [],
      propertyName: property.propertyName || '',
      rentCollection: property.rentCollection || { value: '', label: '' },
      rooms,
      apartments: rooms,
      apartmentCount: rooms.length,
      //propertyId: property.propertyId,
      unitsLeft: rooms.filter((room: any) => !room.assignedToTenant).length,
    };
  }
  

  async findPropertyByIdForTenant(id: any, tenantId: any): Promise<any> {
    let result: any = {};
    let property: any = await this.propertyModel
      .findOne({ _id: id })
      .populate('createdBy');
    let hasTenantApplied: any = await this.applicationModel.findOne({
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
      result.zipCode = property.zipCode;
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
      result.zipCode = property.zipCode;
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
    if (body.file != 'null' || null)  {
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
      currentResidence: body.currentResidence,
      monthlyIncome: body.monthlyIncome,
    };

    try {
      const newApplication =
        await this.applicationModel.create(applicationData);
      return newApplication;
    } catch (error) {
      throw new Error(`Failed to creating application: ${error.message}`);
    }
  }

  async getLandlordApplications(
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

          }
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

          }
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

  async updateApplicationStatusById(id: any, newStatus: string, roomId?: any): Promise<any> {

    try {
      if (newStatus === "activeTenant") {
        const doesActiveTenantExists = await this.applicationModel.findOne({ propertyId: roomId }).where("status").equals("activeTenant");
        if (doesActiveTenantExists) return new BadRequestException("This property/apartment has an active tenant")
      }
      const updatedApplication = await this.findApplicationyById(id);

      updatedApplication.status = newStatus;

      return updatedApplication.save();
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

  async getLandLordCount(
    id: any,
  ): Promise<{
    totalNew: number;
    totalAccepted: number;
    totalActiveTenants: number;
    totalProperties: number;
  } | any> {
    try {
      const totalNewPromise = this.applicationModel
        .countDocuments({ ownerId: id, status: 'New' })
        .exec();
      const totalAcceptedPromise = this.applicationModel
        .countDocuments({ ownerId: id, status: 'Accepted' })
        .exec();

      const x = await this.findLandlordOnboardedTenants(id);
      const totalActiveTenantsPromise = await this.applicationModel
        .countDocuments({ ownerId: id, status: 'activeTenant' })
        .exec();
       
        const totalPropertiesPromise = await this.propertyModel
        .countDocuments({ createdBy: id })
        .exec();

      let [totalNew, totalAccepted, totalActiveTenants, totalProperties] = await Promise.all([
        totalNewPromise,
        totalAcceptedPromise,
        totalActiveTenantsPromise + x.length,
        totalPropertiesPromise
      ]);
      return {
        totalNew,
        totalAccepted,
        totalActiveTenants,
        totalProperties
      };
    } catch (error) {
      throw new Error(`Failed to fetch landlord applications: ${error}`);
    }
  }

  async getTenantMetrics(
    id: any,
  ): Promise<{
    totalNew: number;
    totalAccepted: number;
    totalActiveTenants: number;
  } | any> {
    try {
      const totalNewPromise = this.applicationModel
        .countDocuments({ applicant: id, status: 'New' })
        .exec();
      const totalAcceptedPromise = this.applicationModel
        .countDocuments({ applicant: id, status: 'activeTenant' })
        .exec();

      const totalActiveTenantsPromise = await this.maintenanceModel
        .countDocuments({ createdBy: id })
        .exec();

      let [totalNew, totalAccepted, totalActiveTenants] = await Promise.all([
        totalNewPromise,
        totalAcceptedPromise,
        totalActiveTenantsPromise,
      ]);
      return {
        totalNew,
        totalAccepted,
        totalActiveTenants,
      };
    } catch (error) {
      throw new Error(`Failed to fetch landlord applications: ${error}`);
    }
  }

  async isPropertyMappedToActiveTenant(propertyId: string): Promise<boolean> {
    try {
      const existingMapping = await this.landlordAssignedTenantModel.findOne({
        propertyId: propertyId,
        status: 'active'
      });
      const doesActiveTenantExist = await this.applicationModel.findOne({
        propertyId: propertyId,
        status: 'activeTenant'
      });

      if (doesActiveTenantExist) {
        throw new BadRequestException("This property/apartment has an active tenant");
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
        throw new Error(`The propertyId ${propertyId} is already mapped to an active tenant.`);
      }
      const newApplication = await this.landlordAssignedTenantModel.create(payload);
      return newApplication;

    } catch (error) {
      throw new Error(`Failed to map user to this apartment: ${error.message}`);
    }
  }

  async findLandlordOnboardedTenants(id: any): Promise<any> {
    const tenants = await this.landlordAssignedTenantModel.find({ ownerId: id, status: "active" }).populate('ownerId').populate({
      path: 'propertyId',
      populate: {
        path: 'propertyId',

      }
    }).populate('applicant');
    return tenants;
  }

  async findTenantHistory(nin: string, userId: any): Promise<any> {
    const user = await this.userModel.findOne({ nin: nin });
    if (!user) {
      return null;
    }
  
    let owner = await this.userModel.findOne({ _id: userId });  
    if (owner) {
      const historyExists = owner.tenantVerficationHistory.some(
        (history: any) => history.nin.includes(nin)
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
  
      const tenants = await this.landlordAssignedTenantModel.find({ applicant: user._id })
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
        const existingUnsignedDocument = await this.agreementDocumentsModel.findOne({
          applicant: body.applicant,
          status: 'Unsigned',
        });
        if (existingUnsignedDocument) {
          throw new Error('An unsigned agreement document for this applicant already exists.');
        }
      }
  
      // Handle uploading of the unsigned document if present
      let unsignedDocument = null;
      if (body.unsignedDocument && body.unsignedDocument.length > 0) {
        unsignedDocument = await this.cloudinaryService.upload(body.unsignedDocument[0]);
        if (!unsignedDocument) {
          throw new Error('Failed to upload unsigned document.');
        }
      }
  
      // Handle uploading of the signed document if present
      let signedDocument = null;
      if (body.signedDocument && body.signedDocument.length > 0) {
        signedDocument = await this.cloudinaryService.upload(body.signedDocument[0]);
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
      const newAgreementDocuments = await this.agreementDocumentsModel.create(data);
      return newAgreementDocuments;
    } catch (error) {
      throw new Error(`Failed to create or update agreement document: ${error.message}`);
    }
  }
  
}
