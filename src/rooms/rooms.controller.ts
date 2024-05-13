import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateRoomDTO } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';
import { createRoomSchema } from '../validations/validator';

@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) { }

  @Post('/create')
  async createRoom(@Body() roomData: CreateRoomDTO[]) {
    try {
      const createdRooms = [];
      let result = [];

      // Iterate through each room data and validate
      for (const room of roomData) {
        console.log({ room });

        const validationResult = createRoomSchema.validate(room);



        if (validationResult.error) {
          console.log({ error: validationResult.error.message });
          throw new BadRequestException(validationResult.error.message);
        }


        createdRooms.push(validationResult.value);
        console.log({ createdRooms });

        if (createdRooms.length === roomData.length) {
          const data = await this.roomsService.createRooms(createdRooms)
          return {
            status: "success",
            message: "Rooms added successfully",
            data: data
          };
        }
      }
    } catch (error) {
      throw new BadRequestException(error.message);
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
}
