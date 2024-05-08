import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property } from './entities/property.entity';

@Injectable()
export class PropertiesService {

  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private cloudinaryService: CloudinaryService
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
    return await this.propertyModel.find({createdBy: id});
  }


}
