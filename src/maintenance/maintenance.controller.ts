import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFiles,
  BadRequestException,
  UseInterceptors,
  Query,
  Put,
} from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { createMaintenanceSchema } from '../validations/validator'; // Assuming you have Joi validation schema defined
import { Maintenance } from './entities/maintenance.entity';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  private createSuccessResponse(data: any) {
    return {
      status: 'success',
      data: data,
    };
  }

  @Post('/create')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  async createMaintenance(
    @Body() maintenanceData: any,
    @UploadedFiles() files: { file?: Express.Multer.File },
  ) {
    try {
      const createMaintenanceDTO = { ...maintenanceData, ...files };
      const validationResult =
        createMaintenanceSchema.validate(maintenanceData);
      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }
      const data = await this.maintenanceService.create(createMaintenanceDTO);

      return this.createSuccessResponse({
        message: 'Maintenance logged successfully',
        data: data,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Put('/update/:id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  async updateMaintenance(
    @Param('id') id: string,
    @Body() maintenanceData: any,
    @UploadedFiles() files: { file?: Express.Multer.File },
  ) {
    try {
      const updateMaintenanceDTO = { ...maintenanceData, ...files };
      const updatedMaintenance: Maintenance =
        await this.maintenanceService.update(id, updateMaintenanceDTO);

      if (!updatedMaintenance) {
        throw new BadRequestException('Maintenance not found');
      }

      return {
        message: 'Maintenance updated successfully',
        data: updatedMaintenance,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/get-tenant-maintenance/:roomId/:createdBy')
  async findAll(
    @Param('createdBy') createdBy: any,
    @Param('roomId') roomId: any,
  ) {
    try {
      const data = await this.maintenanceService.findAll(createdBy, roomId);
      return this.createSuccessResponse(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  @Get('/get-apartment-maintenance/:roomId')
  async findApartmentMaintenance(
    @Param('roomId') roomId: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    try {
      const data = await this.maintenanceService.findMaintenancePerApartment(
        roomId,
        +page,
        +limit,
        status,
        search,
      );
      return data;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // maintenance.controller.ts
  @Get('get-landlord-maintenance/:ownerId')
  async getByOwnerId(
    @Param('ownerId') ownerId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.maintenanceService.findAllByOwnerId(
      ownerId,
      +page,
      +limit,
      status,
      search,
    );
  }

  @Get('/single/:id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.maintenanceService.findOne(id);
      return this.createSuccessResponse(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/resolve/:status/:id')
  async update(@Param('id') id: string, @Param('status') status: string) {
    try {
      // Update maintenance record using service
      const data = await this.maintenanceService.updateMaintenanceStatus(
        id,
        status,
      );

      return this.createSuccessResponse({
        message: 'Issue marked as resolved',
        data: data,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const data = await this.maintenanceService.remove(id);
      return this.createSuccessResponse({
        message: 'Maintenance deleted successfully',
        data: data,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/get-tenant-maintenance/:id')
  async findAllTenantMaintenance(@Param('id') id: any) {
    try {
      const data =
        await this.maintenanceService.findAllMaintenanceByTenantId(id);
      return this.createSuccessResponse(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
