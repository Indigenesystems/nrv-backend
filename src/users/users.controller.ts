import { Controller, Post, Body, Get, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { createUserSchema, confirmUserSchema } from '../validations/validator';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './users.service';
import { ConfirmUserDto } from './dto/confirm-user.dto';

@Controller('users')
export class UserController {
  constructor(
    private userService: UserService
  ){ }
  
  @Post()
  async createUser(@Body() userData: CreateUserDto) {
    try {
      const validationResult = createUserSchema.validate(userData);

      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }

      const createdUser = await this.userService.createUser(userData);

      if (createdUser.firstName) {
        return {
          status: "success",
          message: "User created successfully",
          data: createdUser
        };
      } else {
        throw new BadRequestException(createdUser);
      }

    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async getUsers() {
    const users = await this.userService.findAllUsers();
    if (!users) {
      return {
        status: "success",
        message: "No user found",
        data: null
      }
    } else {
      return {
        status: "success",
        message: "All users fetched successfully",
        data: users
      };
    }
  }

  @Post('/confirm-account')
  async confirmAccount(@Body() body: ConfirmUserDto): Promise<any> {
    try {
      const validationResult = confirmUserSchema.validate(body);

      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }

      const result = await this.userService.confirmAccount(body);

      return {
        status: "success",
        message: "Account Confirmed",
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }  else if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      } else {
        throw new InternalServerErrorException('Failed to confirm account');
      }
    }
  }
}

