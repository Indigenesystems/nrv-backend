import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { Property } from './entities/property.entity';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class PropertiesService {

  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private cloudinaryService: CloudinaryService,
    private roomService: RoomsService
  ) { }
  async createProperty(createPropertyDto: any) {
    const imageUrl = await this.cloudinaryService.upload(createPropertyDto.file);
    let property: any = {};
    property.file = imageUrl;
    property.unit = createPropertyDto.body.unit
    property.city = createPropertyDto.body.city
    property.streetAddress = createPropertyDto.body.streetAddress
    property.state = createPropertyDto.body.state
    property.zipCode = createPropertyDto.body.zipCode
    property.createdBy = createPropertyDto.body.createdBy

    const newProperty = new this.propertyModel(property)
    const createdProperty = await newProperty.save()
    return createdProperty;
  }

  async findPropertyByUserId(id: any): Promise<any> {
    return await this.propertyModel.find({ createdBy: id });
  }

  async findPropertyById(id: any): Promise<any> {
    let result: any = {}
    let property: any = await this.propertyModel.findOne({ _id: id });
    const rooms = await this.roomService.roomByPropertyId(id);

    result._id = property._id;
    result.streetAddress = property.streetAddress;
    result.unit = property.unit;
    result.city = property.city;
    result.state = property.state;
    result.zipCode = property.zipCode;
    result.file = property.file;
    result.createdBy = property.createdBy;
    result.rooms = rooms;
    return result;
  }
  
}
