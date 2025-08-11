import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { createRoomSchema } from '../validations/validator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { LandlordAssignedTenant } from '../properties/entities/landlord_assigned_tenant.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';


@Controller('rooms')
export class RoomsController {
  constructor(
    @InjectModel(AgreementDocuments.name)
    private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    private roomsService: RoomsService,
    @InjectModel(LandlordAssignedTenant.name)
    private readonly landlordAssignedTenantModel: Model<LandlordAssignedTenant>,
  ) {}

  @Post('/create')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]))
  async createRoom(
    @Body() roomData: any,
    @UploadedFiles() files: { 
      file?: Express.Multer.File;
      images?: Express.Multer.File[];
    },
  ) {
    try {
      console.log('Backend received roomData:', roomData);
      console.log('Backend received files:', files);
      console.log('Backend received images:', files.images);
      
      const createRoomDTO = { ...roomData, ...files };
      console.log('Backend createRoomDTO:', createRoomDTO);
      
      const validationResult = createRoomSchema.validate(roomData);

      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }

      const data = await this.roomsService.createRooms(createRoomDTO);
      return {
        status: 'success',
        message: 'Rooms added successfully',
        data: data,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  @Get('/all')
  async findPropertiesByUserId(
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('id') id?: string,
  ) {
    const properties = await this.roomsService.findAllApartments(
      page,
      limit,
      search,
      minPrice,
      maxPrice,
      id,
    );
    if (!properties || properties.length === 0) {
      return {
        status: 'success',
        message: 'No apartment found',
        data: null,
      };
    } else {
      return {
        status: 'success',
        message: 'Apartment fetched',
        data: properties,
      };
    }
  }

  @Get('/:id')
  async findProperyByUserId(@Param('id') id: string) {
    const users = await this.roomsService.roomByPropertyId(id);
    if (!users) {
      return {
        status: 'success',
        message: 'No room found',
        data: null,
      };
    } else {
      return {
        status: 'success',
        message: 'rooms fetched',
        data: users,
      };
    }
  }

  @Get('/active/tenant')
  async getPropertyActiveTenant(@Query('id') id: string) {
    try {
      let finalResult: any = null;
      let agreementDocument = null;
      const activeTenant =
        await this.roomsService.findCurrentOccupantForRoom(id);

      if (activeTenant) {
        finalResult = activeTenant;
      } else {
        finalResult = await this.landlordAssignedTenantModel
          .findOne({
            propertyId: id,
            status: 'active',
          })
          .populate('propertyId')
          .populate('applicant')
          .lean();
      }
      if (!finalResult) {
        throw new Error(
          'No active tenant or assignment found for the given property ID.',
        );
      }

      if (finalResult?.applicant?._id) {
        agreementDocument = await this.agreementDocumentsModel.findOne({
          applicant: finalResult.applicant._id.toString(),
        });
        finalResult = {
          finalResult,
          agreementDocument: agreementDocument || null,
        };
        console.log('Final Result with Agreement Document:', finalResult);
      }
      return {
        status: 'success',
        message: 'Active tenant fetched successfully',
        data: finalResult._doc ? finalResult._doc : finalResult,
      };
    } catch (error) {
      console.error('Error fetching active tenant:', error);
      throw new BadRequestException({
        status: 'error',
        message:
          error.message ||
          'An error occurred while fetching the active tenant.',
      });
    }
  }

  @Get('/update/status')
  async update(@Query('id') id: string, @Query('status') status: boolean) {
    try {
      const updatedSubProperty =
        await this.roomsService.updateSubPropertyStatus(id, status);
      return {
        status: 'success',
        message: 'Sub property updated successfully',
        data: updatedSubProperty,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/single/:id')
  async findSinglePropertyById(@Param('id') id: string) {
    const user = await this.roomsService.singlePropertyById(id);
    if (!user) {
      return {
        status: 'success',
        message: 'No room found',
        data: null,
      };
    } else {
      return {
        status: 'success',
        message: 'room fetched successfully',
        data: user,
      };
    }
  }

  @Get('/single/tenant/:id/:tenantId')
  async findPropertyByIdForTenant(
    @Param('id') id: string,
    @Param('tenantId') tenantId: string,
  ) {
    const property = await this.roomsService.findPropertyByIdForTenant(
      id,
      tenantId,
    );
    if (!property) {
      return {
        status: 'error',
        message: 'No property found',
        data: property,
      };
    } else {
      return {
        status: 'success',
        message: 'Property fetched',
        data: property,
      };
    }
  }

  @Get('/properties/renters')
  async getRentedProperties(@Query('id') id: string) {
    try {
      const properties = await this.roomsService.findRentedApartments(id);
      return {
        status: 'success',
        message: 'Properties fetched',
        data: properties,
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Put(':id/extend-tenancy')
  async updateRentEndDate(
    @Param('id') id: string,
    @Body('rentEndDate') rentEndDate: Date,
  ) {
    try {
      // Validate rentEndDate format (optional)
      if (!rentEndDate || isNaN(new Date(rentEndDate).getTime())) {
        throw new BadRequestException('Invalid rent end date');
      }

      // Update the rentEndDate
      const updatedTenant = await this.roomsService.updateRentEndDate(
        id,
        rentEndDate,
      );

      if (!updatedTenant) {
        throw new BadRequestException('LandlordAssignedTenant not found');
      }

      return {
        status: 'success',
        message: 'Rent end date updated successfully',
        data: updatedTenant,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Put(':id/assign-tenancy-date')
  async updateRentEndAndStartDate(
    @Param('id') id: string,
    @Body('rentEndDate') rentEndDate: Date,
    @Body('rentStartDate') rentStartDate: Date,
  ) {
    try {
      // Validate rentEndDate format (optional)
      if (!rentEndDate || isNaN(new Date(rentEndDate).getTime())) {
        throw new BadRequestException('Invalid rent end date');
      }

      // Update the rentEndDate
      const updatedTenant = await this.roomsService.assignStartAndEndDate(
        id,
        rentEndDate,
        rentStartDate,
      );

      if (!updatedTenant) {
        throw new BadRequestException('Application not found');
      }

      return {
        status: 'success',
        message: 'Rent start and end date assigned successfully',
        data: updatedTenant,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  
  assignStartAndEndDate;

  @Put(':id/end-tenure')
  async endRentTenure(@Param('id') id: string) {
    try {
      // Find the landlord assigned tenant by ID and mark the tenure as ended
      const updatedTenant = await this.roomsService.endRentTenure(id);

      if (!updatedTenant) {
        throw new BadRequestException('LandlordAssignedTenant not found');
      }

      return {
        status: 'success',
        message: 'Rent tenure ended successfully',
        data: updatedTenant,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
