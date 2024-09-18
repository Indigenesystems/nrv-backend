import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { Property } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Application } from './entities/application.entity';
import { EmailService } from '../email-sender/email.service';
import { LandlordAssignedTenant } from './entities/landlord_assigned_tenant.entity';
import { Room } from '../rooms/entities/room.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Application.name) private readonly applicationModel: Model<Application>,
    @InjectModel(LandlordAssignedTenant.name) private readonly landlordAssignedTenantModel: Model<LandlordAssignedTenant>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
    private roomService: RoomsService,
    private emailService: EmailService

  ) { }

  async createProperty(createPropertyDto: any) {
    let landlordInsurancePolicyUrls: any = null;
    let utilityAndMaintenanceUrls: any = null;
    let otherDocumentsUrls: any = null;

    // Upload single file
    const fileUrl = await this.cloudinaryService.upload(
      createPropertyDto.file[0],
    );

    if (createPropertyDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        createPropertyDto.landlordInsurancePolicy.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );
    }

    if (createPropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        createPropertyDto.utilityAndMaintenance.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );
    }

    if (createPropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        createPropertyDto.otherDocuments.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );
    }
    // Construct the property data object
    const propertyData = {
      file: fileUrl,
      unit: createPropertyDto.unit,
      city: createPropertyDto.city,
      propertyType: createPropertyDto.propertyType,
      streetAddress: createPropertyDto.streetAddress,
      state: createPropertyDto.state,
      zipCode: createPropertyDto.zipCode,
      createdBy: createPropertyDto.createdBy,
      landlordInsurancePolicy: landlordInsurancePolicyUrls,
      utilityAndMaintenance: utilityAndMaintenanceUrls,
      otherDocuments: otherDocumentsUrls,
    };
    // Save the new property to the database
    const newProperty = new this.propertyModel(propertyData);
    const createdProperty = await newProperty.save();

    return createdProperty;
  }

  async updateProperty(updatePropertyDto: any) {
    let landlordInsurancePolicyUrls: any;
    let utilityAndMaintenanceUrls: any;
    let otherDocumentsUrls: any;
    let singleProperty = await this.findPropertyById(
      updatePropertyDto?.query?.propertyId,
    );

    if (updatePropertyDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        updatePropertyDto.landlordInsurancePolicy.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );
      if (singleProperty.landlordInsurancePolicy !== null) {
        singleProperty.landlordInsurancePolicy = [
          ...singleProperty.landlordInsurancePolicy,
          ...landlordInsurancePolicyUrls,
        ];
      } else {
        singleProperty.landlordInsurancePolicy = landlordInsurancePolicyUrls;
      }
    }
    if (updatePropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        updatePropertyDto.utilityAndMaintenance.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );
      if (singleProperty.utilityAndMaintenance !== null) {
        singleProperty.utilityAndMaintenance = [
          ...singleProperty.utilityAndMaintenance,
          ...utilityAndMaintenanceUrls,
        ];
      } else {
        singleProperty.utilityAndMaintenance = utilityAndMaintenanceUrls;
      }
    }
    if (updatePropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        updatePropertyDto.otherDocuments.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );
      if (singleProperty.otherDocuments !== null) {
        singleProperty.otherDocuments = [
          ...singleProperty.otherDocuments,
          ...otherDocumentsUrls,
        ];
      } else {
        singleProperty.otherDocuments = otherDocumentsUrls;
      }
    }
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

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      updatePropertyDto?.query?.propertyId,
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

  async findAllProperty(page: number = 1, limit: number = 10): Promise<any> {
    const skip = (page - 1) * limit;
    const properties = await this.propertyModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    return properties;
  }

  async findPropertyById(id: any): Promise<any> {
    let result: any = {};
    let property: any = await this.propertyModel
      .findOne({ _id: id })
      .populate('createdBy');

    if (property) {
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
      return result;
    }
    return new NotFoundException();
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
      console.log("I enter here");
      
      fileUrl = await this.cloudinaryService.upload(body.file[0]);
    }


    console.log({ fileUrl });

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

    console.log({ applicationData });

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
  } | any> {
    try {
      // Query to count total number of applicants for each status
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


      // Await all promises to get the results
      let [totalNew, totalAccepted, totalActiveTenants] = await Promise.all([
        totalNewPromise,
        totalAcceptedPromise,
        totalActiveTenantsPromise + x.length,
      ]);

      // Return applications and totals
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
      // Check if there's an active landlordAssignedTenant with the same propertyId
      const existingMapping = await this.landlordAssignedTenantModel.findOne({
        propertyId: propertyId,
        status: 'active'
      });

      // Check if there's an active application with the same propertyId
      const doesActiveTenantExist = await this.applicationModel.findOne({
        propertyId: propertyId,
        status: 'activeTenant'
      });

      if (doesActiveTenantExist) {
        // Handle the case where an active tenant exists (if necessary)
        throw new BadRequestException("This property/apartment has an active tenant");
      }

      // Return true if an active mapping exists, otherwise false
      return !!existingMapping;
    } catch (error) {
      // Handle the error in a way that fits your application
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
    const tenants = await this.landlordAssignedTenantModel.find({ ownerId: id }).populate('ownerId').populate({
      path: 'propertyId',
      populate: {
        path: 'propertyId',

      }
    }).populate('applicant');
    return tenants;
  }

  async findTenantHistory(nin: any): Promise<any> {
    const user = await this.userModel.findOne({ nin: nin });

    if (user) {
      const userId = user._id;

      const tenants = await this.landlordAssignedTenantModel.find({ applicant: userId }).populate('ownerId').populate({
        path: 'propertyId',
        populate: {
          path: 'propertyId',

        }
      }).populate('applicant');

      return tenants;
    }
    return null;
  }

}
