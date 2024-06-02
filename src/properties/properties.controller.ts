import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { createPropertySchema } from '../validations/validator';

@Controller('properties')
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) { }

  @Post('/add')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads', // Set your destination path
      filename: (req, file, cb) => {
        const filename: string = path.parse(file.originalname).name.replace(/\s/g, '') + '-' + Date.now() + path.parse(file.originalname).ext;
        cb(null, filename);
      },
    }),
  }))
  async create(@Body() body: any, @UploadedFile() file: Express.Multer.File): Promise<any> {

    const validationResult = createPropertySchema.validate(body);

    if (validationResult.error) {
      throw new BadRequestException(validationResult.error.message);
    }
    const createPropertyDto = Object.assign({ file, body });
    const createdProperty = await this.propertiesService.createProperty(createPropertyDto);

    if (createdProperty.city) {
      return {
        status: "success",
        message: "Property added successfully",
        data: createdProperty
      };
    } else {
      throw new BadRequestException(createdProperty);
    }

  }

  // @Get('/all/:id')
  // async findProperyByUserId(@Param('id') id: string, ) {
  //   const users = await this.propertiesService.findPropertyByUserId(id);
  //   if (!users) {
  //     return {
  //       status: "success",
  //       message: "No property found",
  //       data: null
  //     }
  //   } else {
  //     return {
  //       status: "success",
  //       message: "Properties fetched",
  //       data: users
  //     };
  //   }
  // }

  @Get('/all/:id')
  async findPropertiesByUserId(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const properties = await this.propertiesService.findPropertyByUserId(id, page, limit);
    
    if (!properties || properties.length === 0) {
      return {
        status: 'success',
        message: 'No properties found',
        data: null,
      };
    } else {
      return {
        status: 'success',
        message: 'Properties fetched',
        data: properties,
      };
    }
  }

  @Get('/single/:id')
  async findPropertyById(@Param('id') id: string, ) {
    const property = await this.propertiesService.findPropertyById(id);
    if (!property) {
      return {
        status: "success",
        message: "No property found",
        data: null
      }
    } else {
      return {
        status: "success",
        message: "Property fetched",
        data: property
      };
    }
  }

}
