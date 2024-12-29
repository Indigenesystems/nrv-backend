import { Controller, Get, Post, Body, Patch, Param, Delete, UploadedFiles, BadRequestException, UseInterceptors } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { createMaintenanceSchema } from '../validations/validator'; // Assuming you have Joi validation schema defined

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  private createSuccessResponse(data: any) {
    return {
      status: "success",
      data: data
    };
  }

  private createErrorResponse(message: string) {
    return {
      status: "error",
      message: message
    };
  }

  @Post('/create')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
  ]))
  async createMaintenance(
    @Body() maintenanceData: any,
    @UploadedFiles() files: { file?: Express.Multer.File }
  ) {
    try {
      // Combine maintenanceData and files into createMaintenanceDTO
      const createMaintenanceDTO = { ...maintenanceData, ...files };

      // Validate request data using Joi schema
      const validationResult = createMaintenanceSchema.validate(maintenanceData);
      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }

      // Create maintenance record using service
      const data = await this.maintenanceService.create(createMaintenanceDTO);

      return this.createSuccessResponse({
        message: "Maintenance logged successfully",
        data: data
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/get-tenant-maintenance/:roomId/:createdBy')
  async findAll(@Param('createdBy') createdBy: any, @Param('roomId') roomId: any) {
    try {
      const data = await this.maintenanceService.findAll(createdBy, roomId);
      return this.createSuccessResponse(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/get-landlord-maintenance/:ownerId')
  async findAllByOwnerId(@Param('ownerId') ownerId: any) {
    try {
      const data = await this.maintenanceService.findAllByOwnerId(ownerId);
      return this.createSuccessResponse(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
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
  async update(
    @Param('id') id: string,
    @Param('status') status: string,
  ) {
    try {

      // Update maintenance record using service
      const data = await this.maintenanceService.updateMaintenanceStatus(id, status);

      return this.createSuccessResponse({
        message: "Issue marked as resolved",
        data: data
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
        message: "Maintenance deleted successfully",
        data: data
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/get-tenant-maintenance/:id')
  async findAllTenantMaintenance(@Param('id') id: any) {
    try {
      const data = await this.maintenanceService.findAllMaintenanceByTenantId(id);
      return this.createSuccessResponse(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
