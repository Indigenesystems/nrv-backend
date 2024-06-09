import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, Query, UploadedFiles } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FileInterceptor, FilesInterceptor , FileFieldsInterceptor} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { createPropertySchema, updatePropertySchema } from '../validations/validator';
import { extname } from 'path';
import { query } from 'express';

@Controller('properties')
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) { }


  @Post('/add')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'landlordInsurancePolicy', maxCount: 5 },
    { name: 'utilityAndMaintenance', maxCount: 5 },
    { name: 'otherDocuments', maxCount: 5 },
  ]))
  async create(
    @Body() body: CreatePropertyDto,
    @UploadedFiles() files: { file?: Express.Multer.File, landlordInsurancePolicy?: Express.Multer.File , utilityAndMaintenance?: Express.Multer.File , otherDocuments?: Express.Multer.File }
  ): Promise<any> {
    const validationResult = createPropertySchema.validate(body);

    if (validationResult.error) {
      throw new BadRequestException(validationResult.error.message);
    }
    const createPropertyDto = { ...body, ...files };

    try {
      const createdProperty = await this.propertiesService.createProperty(createPropertyDto);
      return {
        status: "success",
        message: "Property added successfully",
        data: createdProperty
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch('/update')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'landlordInsurancePolicy', maxCount: 5 },
    { name: 'utilityAndMaintenance', maxCount: 5 },
    { name: 'otherDocuments', maxCount: 5 },
  ]))
  async update(
    @Body() body: UpdatePropertyDto, @Query() query: 'propertyId',
    @UploadedFiles() files: { file?: Express.Multer.File, landlordInsurancePolicy?: Express.Multer.File , utilityAndMaintenance?: Express.Multer.File , otherDocuments?: Express.Multer.File }
  ): Promise<any> {
    const validationResult = updatePropertySchema.validate(body);

    if (validationResult.error) {
      throw new BadRequestException(validationResult.error.message);
    }
    const createPropertyDto = { ...body, ...files , query};
    try {
      const updatedProperty = await this.propertiesService.updateProperty(createPropertyDto);
      return {
        status: "success",
        message: "Property updated successfully",
        data: updatedProperty
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

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
  async findPropertyById(@Param('id') id: string,) {
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

  @Delete('/delete/:id')
  async deletePropertyById(@Param('id') id: string,) {
    const property = await this.propertiesService.deletePropertyById(id);
    if (!property) {
      return {
        status: "error",
        message: "An error occured",
        data: null
      }
    } else {
      return {
        status: "success",
        message: "Property deleted successfully",
        data: null
      };
    }
  }

  @Delete('/delete-document')
  async deleteDocument(
    @Query('id') id: string,
    @Query('documentUrl') documentUrl: string,
  ) {
    return this.propertiesService.deleteDocument(id, documentUrl);
  }

}
