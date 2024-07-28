import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { CreateRoomDTO } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';
import { createRoomSchema } from '../validations/validator';
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';


@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) { }

  @Post('/create')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
  ]))
  async createRoom(@Body() roomData: any, @UploadedFiles() files: { file?: Express.Multer.File }) {
    try {
      const createRoomDTO = { ...roomData, ...files };
      const validationResult = createRoomSchema.validate(roomData);

    if (validationResult.error) {
      throw new BadRequestException(validationResult.error.message);
    }
      
      const data = await this.roomsService.createRooms(createRoomDTO)
      return {
        status: "success",
        message: "Rooms added successfully",
        data: data
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
  ) {
    
    const properties = await this.roomsService.findAllApartments(page, limit , search, minPrice , maxPrice);

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
  async findProperyByUserId(@Param('id') id: string,) {
    const users = await this.roomsService.roomByPropertyId(id);
    if (!users) {
      return {
        status: "success",
        message: "No room found",
        data: null
      }
    } else {
      return {
        status: "success",
        message: "rooms fetched",
        data: users
      };
    }
  }

 

  @Get('/active/tenant')
  async getPropertyActiveTenant(@Query('id') id: string)
  {
    try {
      const activeTenant = await this.roomsService.findCurrentOccupantForRoom(id);
      return {
        status: "success",
        message: "Active tenant fetched",
        data: activeTenant
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Get('/update/status')
  async update(@Query('id') id: string, @Query('status') status: boolean)
  {
    try {
      const updatedSubProperty = await this.roomsService.updateSubPropertyStatus(id, status);
      return {
        status: "success",
        message: "Sub property updated successfully",
        data: updatedSubProperty
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
        status: "success",
        message: "No room found",
        data: null
      }
    } else {
      return {
        status: "success",
        message: "room fetched successfully",
        data: user
      };
    }
  }

  @Get('/single/tenant/:id/:tenantId')
  async findPropertyByIdForTenant(@Param('id') id: string, @Param('tenantId') tenantId: string,) {
    const property = await this.roomsService.findPropertyByIdForTenant(id, tenantId);
    if (!property) {
      return {
        status: "error",
        message: "No property found",
        data: property
      }
    } else {
      return {
        status: "success",
        message: "Property fetched",
        data: property
      };
    }
  }
  

  @Get('/properties/renters')
  async getRentedProperties(@Query('id') id: string)
  {
    try {
      const properties = await this.roomsService.findRentedApartments(id);
      return {
        status: "success",
        message: "Properties fetched",
        data: properties
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

}
