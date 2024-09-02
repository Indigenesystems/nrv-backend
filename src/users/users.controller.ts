import { Controller, Post, Body, Get, BadRequestException, NotFoundException, InternalServerErrorException, Put, Param } from '@nestjs/common';
import { createUserSchema, confirmUserSchema, createUserByLandlordSchema } from '../validations/validator';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './users.service';
import { ConfirmUserDto } from './dto/confirm-user.dto';
import { User } from './entities/user.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcryptjs';

@Controller('users')
export class UserController {
  constructor(
    private userService: UserService,
    private authService: AuthService
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
  @Post('/landlord')
  async createUserByLandLord(@Body() userData: CreateUserDto | any) {
    try {

      const validationResult = createUserByLandlordSchema.validate(userData);

      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }

      const createdUser = await this.userService.createUserByLandlord(userData);

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
      if (result) {

        return result
      } else {
        throw new NotFoundException('User not found'); 
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error; 
      } else {
        throw new InternalServerErrorException('Failed to confirm account');
      }
    }
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updatedUser: User): Promise<User> {
    return await this.userService.updateUser(id, updatedUser);
  }

  @Post('/request-password-reset')
async requestPasswordReset(@Body('email') email: string) {
  const user: any = await this.userService.findUserByEmail(email);
  if (!user) {
    // You can either notify that the email was not found or just return a success message
    return;
  }

  const token = this.authService.createPasswordResetToken(user._id);
  await this.userService.savePasswordResetToken(user.email, token);

  return { message: 'Password reset link sent.' };
}

@Post('reset-password')
async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
  const { token, newPassword } = resetPasswordDto;
  


  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await this.userService.updatePassword(token, hashedPassword);

  return { message: 'Password successfully reset.' };
}


}

