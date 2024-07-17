import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, BadRequestException, Query, UploadedFiles, Put } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { createPropertySchema, updatePropertySchema } from '../validations/validator';


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
    @UploadedFiles() files: { file?: Express.Multer.File, landlordInsurancePolicy?: Express.Multer.File, utilityAndMaintenance?: Express.Multer.File, otherDocuments?: Express.Multer.File }
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
    @UploadedFiles() files: { file?: Express.Multer.File, landlordInsurancePolicy?: Express.Multer.File, utilityAndMaintenance?: Express.Multer.File, otherDocuments?: Express.Multer.File }
  ): Promise<any> {
    const validationResult = updatePropertySchema.validate(body);

    if (validationResult.error) {
      throw new BadRequestException(validationResult.error.message);
    }
    const createPropertyDto = { ...body, ...files, query };
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

  @Get('/all')
  async findAllProperties(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const properties = await this.propertiesService.findAllProperty(page, limit);

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

  @Get('/single/tenant/:id/:tenantId')
  async findPropertyByIdForTenant(@Param('id') id: string, @Param('tenantId') tenantId: string,) {
    const property = await this.propertiesService.findPropertyByIdForTenant(id, tenantId);
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


  @Post('/apply')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
  ]))

  async createApplication(@Body() body: any,   @UploadedFiles() files: { file?: Express.Multer.File}) {
    try {
      const createApplicationDTO = { ...body, ...files };
      const createdApplication = await this.propertiesService.createApplication(createApplicationDTO)

      if (createdApplication.propertyId) {
        return {
          status: "success",
          message: "Application created successfully",
          data: createdApplication
        };
      } else {
        throw new BadRequestException(createdApplication);
      }

    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/applications')
  async findApplicantsByLandlordId(
    @Query('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status: string = 'New',
  ) {
    const properties = await this.propertiesService.getLandlordApplications(page, limit, id, status);

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

   @Get('/application-count')
  async findApplicantsByLandlordIdMetrics(
    @Query('id') id: string
  ) {
    const properties = await this.propertiesService.getLandLordCount(id);

    if (!properties || properties.length === 0) {
      return {
        status: 'error',
        message: 'Landlord applications count not found',
        data: null,
      };
    } else {
      return {
        status: "success",
        message: 'Landlord applications count found',
        data: properties,
      };
    }
  }

  @Get('/application/update-status')
  async updateApplicationStatus(
    @Query('id') id: string,
    @Query('status') status: string,
    @Query('roomId') roomId?: any
  ) {
    const application = await this.propertiesService.updateApplicationStatusById(id, status, roomId);
    if (application) {
      return application
    }
  }

  @Get('/application/invite-applicant')
  async sendApplicationInvite(
    @Query('name') name: string,
    @Query('landlordId') landlordId: string,
    @Query('email') email: string
  ) {
    const payload: any = {
      "name": name,
      "email": email,
      "landlordId" : landlordId
    }
    const application = await this.propertiesService.applicationInvitation(payload);
    if (application) {
      return {
        status: 'success',
        message: 'Invitation sent successfully',
      };
    } else {
      return {
        status: 'error',
        message: 'An error occured',
      };
    }
  }
}
