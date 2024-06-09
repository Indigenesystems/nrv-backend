import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { Property } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {

  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private cloudinaryService: CloudinaryService,
    private roomService: RoomsService
  ) { }


  async createProperty(createPropertyDto: any) {
    let landlordInsurancePolicyUrls: any = null
    let utilityAndMaintenanceUrls: any = null
    let otherDocumentsUrls: any = null

    // Upload single file
    const fileUrl = await this.cloudinaryService.upload(createPropertyDto.file[0]);

    if (createPropertyDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        createPropertyDto.landlordInsurancePolicy.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        })
      );
    }

    if (createPropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        createPropertyDto.utilityAndMaintenance.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        })
      );
    }

    if (createPropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        createPropertyDto.otherDocuments.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        })
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
      otherDocuments: otherDocumentsUrls
    };

    console.log({ propertyData });

    // Save the new property to the database
    const newProperty = new this.propertyModel(propertyData);
    const createdProperty = await newProperty.save();

    return createdProperty;
  }

  async updateProperty(updatePropertyDto: any) {

    let landlordInsurancePolicyUrls: any
    let utilityAndMaintenanceUrls: any
    let otherDocumentsUrls: any
    let singleProperty = await this.findPropertyById(updatePropertyDto?.query?.propertyId);

    if (updatePropertyDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        updatePropertyDto.landlordInsurancePolicy.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        })

      );
      if (singleProperty.landlordInsurancePolicy !== null) {
        singleProperty.landlordInsurancePolicy = [...singleProperty.landlordInsurancePolicy, ...landlordInsurancePolicyUrls];
      } else {
        singleProperty.landlordInsurancePolicy = landlordInsurancePolicyUrls;
      }
    }
    if (updatePropertyDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        updatePropertyDto.utilityAndMaintenance.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        })
      );
      if (singleProperty.utilityAndMaintenance !== null) {
        singleProperty.utilityAndMaintenance = [...singleProperty.utilityAndMaintenance, ...utilityAndMaintenanceUrls];
      } else {
        singleProperty.utilityAndMaintenance = utilityAndMaintenanceUrls;
      }

    }
    if (updatePropertyDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        updatePropertyDto.otherDocuments.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        })
      );
      if (singleProperty.otherDocuments !== null) {
        singleProperty.otherDocuments = [...singleProperty.otherDocuments, ...otherDocumentsUrls];
      } else {
        singleProperty.otherDocuments = otherDocumentsUrls;
      }
    }
    if (updatePropertyDto.unit) {
      singleProperty.unit = updatePropertyDto.unit
    }
    if (updatePropertyDto.city) {
      singleProperty.city = updatePropertyDto.city
    }
    if (updatePropertyDto.propertyType) {
      singleProperty.propertyType = updatePropertyDto.propertyType
    }
    if (updatePropertyDto.streetAddress) {
      singleProperty.streetAddress = updatePropertyDto.streetAddress
    }
    if (updatePropertyDto.state) {
      singleProperty.state = updatePropertyDto.state
    }
    if (updatePropertyDto.zipCode) {
      singleProperty.zipCode = updatePropertyDto.zipCode
    }

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      updatePropertyDto?.query?.propertyId,
      singleProperty,
      { new: true, runValidators: true }
    );
    return updatedProperty;
  }

  async findPropertyByUserId(id: any, page: number = 1, limit: number = 10): Promise<any> {
    const skip = (page - 1) * limit;
    const properties = await this.propertyModel
      .find({ createdBy: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    return properties;
  }

  async findPropertyById(id: any): Promise<any> {
    let result: any = {}
    let property: any = await this.propertyModel.findOne({ _id: id });

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

  async deletePropertyById(id: any) {
    const deletedProperty: any = await this.propertyModel.findByIdAndDelete({ _id: id });
    const deletedRooms: any = await this.roomService.deleteRoomByPropertyId(id)
    return deletedProperty;
  }

  async deleteDocument(propertyId: string, documentUrl: string): Promise<any> {
    const property = await this.propertyModel.findById(propertyId);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const fieldsToUpdate = ['otherDocuments', 'landlordInsurancePolicy', 'utilityAndMaintenance'];

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
}
