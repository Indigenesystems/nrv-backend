import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, Query, Res, HttpStatus } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { createPropertySchema, updatePropertySchema } from '../validations/validator';
import { Response } from 'express';

@Controller('properties')
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Post('/add')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'landlordInsurancePolicy', maxCount: 5 },
    { name: 'utilityAndMaintenance', maxCount: 5 },
    { name: 'otherDocuments', maxCount: 5 },
  ]))
  async create(
    @Body() body: CreatePropertyDto,
    @UploadedFiles() files: { 
      file?: Express.Multer.File, 
      landlordInsurancePolicy?: Express.Multer.File, 
      utilityAndMaintenance?: Express.Multer.File, 
      otherDocuments?: Express.Multer.File 
    },
    @Res() res: Response
  ) {
    // const validationResult = createPropertySchema.validate(body);

    // if (validationResult.error) {
    //   return res.status(HttpStatus.BAD_REQUEST).json({
    //     status: 'error',
    //     message: validationResult.error.message,
    //   });
    // }
    const createPropertyDto = { ...body, ...files };
    try {
      const createdProperty = await this.propertiesService.createProperty(createPropertyDto);
      return res.status(HttpStatus.CREATED).json({
        status: 'success',
        message: 'Property added successfully',
        data: createdProperty,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
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
    @Body() body: UpdatePropertyDto, 
    @Query('propertyId') query: string,
    @UploadedFiles() files: { 
      file?: Express.Multer.File, 
      landlordInsurancePolicy?: Express.Multer.File, 
      utilityAndMaintenance?: Express.Multer.File, 
      otherDocuments?: Express.Multer.File 
    },
    @Res() res: Response
  ) {
    const validationResult = updatePropertySchema.validate(body);

    if (validationResult.error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: validationResult.error.message,
      });
    }
    const updatePropertyDto = { ...body, ...files, query };
    try {
      const updatedProperty = await this.propertiesService.updateProperty(updatePropertyDto);
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Property updated successfully',
        data: updatedProperty,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  @Get('/all/:userId')
  async findPropertiesByUserId(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Res() res: Response
  ) {
    console.log({userId});
    
    const properties = await this.propertiesService.findAllProperty( page, limit, userId);

    if (!properties || properties.length === 0) {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'No properties found',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Properties fetched',
        data: properties,
      });
    }
  }

  @Get('/all')
  async findAllProperties(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Res() res: Response
  ) {
    const properties = await this.propertiesService.findAllProperty(page, limit);

    if (!properties || properties.length === 0) {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'No properties found',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Properties fetched',
        data: properties,
      });
    }
  }

  @Get('/single/:id')
  async findPropertyById(@Param('id') id: string, @Res() res: Response) {
    const property = await this.propertiesService.findPropertyById(id);
    if (!property) {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: "No property found",
        data: null
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: "Property fetched",
        data: property
      });
    }
  }

  @Get('/single/tenant/:id/:tenantId')
  async findPropertyByIdForTenant(@Param('id') id: string, @Param('tenantId') tenantId: string, @Res() res: Response) {
    const property = await this.propertiesService.findPropertyByIdForTenant(id, tenantId);
    if (!property) {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: "No property found",
        data: null
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: "Property fetched",
        data: property
      });
    }
  }

  @Delete('/delete/:id')
  async deletePropertyById(@Param('id') id: string, @Res() res: Response) {
    const property = await this.propertiesService.deletePropertyById(id);
    if (!property) {
      return res.status(HttpStatus.NOT_FOUND).json({
        status: "error",
        message: "Property not found",
        data: null
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: "Property deleted successfully",
        data: null
      });
    }
  }

  @Delete('/delete-document')
  async deleteDocument(
    @Query('id') id: string,
    @Query('documentUrl') documentUrl: string,
    @Res() res: Response
  ) {
    try {
      await this.propertiesService.deleteDocument(id, documentUrl);
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Document deleted successfully',
        data: null,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  @Post('/apply')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
  ]))
  async createApplication(@Body() body: any, @UploadedFiles() files: { file?: Express.Multer.File }, @Res() res: Response) {
    try {
      const createApplicationDTO = { ...body, ...files };
      const createdApplication = await this.propertiesService.createApplication(createApplicationDTO);

      if (createdApplication.propertyId) {
        return res.status(HttpStatus.CREATED).json({
          status: "success",
          message: "Application created successfully",
          data: createdApplication
        });
      } else {
        return res.status(HttpStatus.BAD_REQUEST).json({
          status: 'error',
          message: 'Failed to create application',
        });
      }
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  @Get('/applications')
  async findApplicantsByLandlordId(
    @Query('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status: string = 'New',
    @Res() res: Response
  ) {
    const applications = await this.propertiesService.getLandlordApplications(page, limit, id, status);

    if (!applications || applications.length === 0) {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'No applications found',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Applications fetched',
        data: applications,
      });
    }
  }

  @Get('/tenant-applications')
  async getApplicantsByTenantId(
    @Query('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status: string = 'New',
    @Res() res: Response
  ) {
    const applications = await this.propertiesService.findApplicationByTenantId(page, limit, id, status);

    if (!applications || applications.length === 0) {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'No applications found',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Applications fetched',
        data: applications,
      });
    }
  }

  @Get('/application-count')
  async findApplicantsByLandlordIdMetrics(
    @Query('id') id: string,
    @Res() res: Response
  ) {
    const count = await this.propertiesService.getLandLordCount(id);
  
    if (!count) {
      return res.status(HttpStatus.NOT_FOUND).json({
        status: 'error',
        message: 'Landlord applications count not found',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: 'Landlord applications count found',
        data: count,
      });
    }
  }

  @Get('/tenant-metrics')
  async findTenantMetrics(
    @Query('id') id: string,
    @Res() res: Response
  ) {
    const count = await this.propertiesService.getTenantMetrics(id);

    if (!count) {
      return res.status(HttpStatus.NOT_FOUND).json({
        status: 'error',
        message: 'Tenant metrics not loaded successfully',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: 'Tenant metrics retrieved successfukky',
        data: count,
      });
    }
  }

  @Get('/application/update-status')
  async updateApplicationStatus(
    @Query('id') id: string,
    @Query('status') status: string,
    @Res() res: Response,
    @Query('roomId') roomId?: any,
  
  ) {
    try {
      const application = await this.propertiesService.updateApplicationStatusById(id, status, roomId);
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Application status updated successfully',
        data: application,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  @Get('/application/invite-applicant')
  async sendApplicationInvite(
    @Query('name') name: string,
    @Query('landlordId') landlordId: string,
    @Query('email') email: string,
    @Res() res: Response
  ) {
    try {
      const payload: any = {
        name,
        email,
        landlordId
      }
      await this.propertiesService.applicationInvitation(payload);
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Invitation sent successfully',
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: 'An error occurred',
      });
    }
  }

  @Get('/tenant/landlord-onboarded')
  async findLandlordOnboardedTenants(
    @Query('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status: string = 'activeTenant',
    @Res() res: Response
  ) {
    const tenants = await this.propertiesService.findLandlordOnboardedTenants(id);
    const applications = await this.propertiesService.getLandlordApplications(page, limit, id, status);

    if (!tenants || tenants.length === 0) {
      return res.status(HttpStatus.NOT_FOUND).json({
        status: 'error',
        message: 'No tenants found',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: 'Tenants fetched successfully',
        data: [...tenants, ...applications],
      });
    }
  }

  @Get('/tenant-history')
  async fetchTenantHistoryByNin(
    @Query('nin') nin: string,
    @Query('userId') userId: string,
    @Res() res: Response
  ) {
    const tenantHistory = await this.propertiesService.findTenantHistory(nin, userId);

    if (!tenantHistory || tenantHistory.length === 0) {
      return res.status(HttpStatus.NOT_FOUND).json({
        status: 'error',
        message: 'No record found for this tenant',
        data: null,
      });
    } else {
      return res.status(HttpStatus.OK).json({
        status: "success",
        message: 'Tenant rent history fetched successfully',
        data: tenantHistory,
      });
    }
  }

  @Post('/upload-agreement-document')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'unsignedDocument', maxCount: 1 },
    { name: 'signedDocument', maxCount: 1 },
  ]))
  async createAgreementDocuments(@Body() body: any, @UploadedFiles() files: { unsignedDocument?: Express.Multer.File, signedDocument?: Express.Multer.File  }, @Res() res: Response) {
    try {
      const data = { ...body, ...files };
      const createdApplication = await this.propertiesService.uploadAgreementDocuments(data);

      if (createdApplication.propertyId) {
        return res.status(HttpStatus.CREATED).json({
          status: "success",
          message: "Agreement document uploaded successfully",
          data: createdApplication
        });
      } else {
        return res.status(HttpStatus.BAD_REQUEST).json({
          status: 'error',
          message: 'Failed to upload agreement document',
        });
      }
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}
