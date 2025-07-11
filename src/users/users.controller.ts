import {
  Controller,
  Post,
  Body,
  Get,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Put,
  Param,
  Patch,
  UseInterceptors,
  UploadedFiles,
  Res,
  HttpStatus,
  HttpException,
  Query,
} from '@nestjs/common';
import {
  createUserSchema,
  confirmUserSchema,
  createUserByLandlordSchema,
} from '../validations/validator';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './users.service';
import { ConfirmUserDto } from './dto/confirm-user.dto';
import { User } from './entities/user.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcryptjs';
import { UpdateNotificationSettingsDto } from './dto/update-notificationSettings.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { query, Response } from 'express';


@Controller('users')
export class UserController {
  constructor(
    private userService: UserService,
    private authService: AuthService,
  ) {}

  /**
   * Create a new user
   */
  @Post()
  async createUser(@Body() userData: CreateUserDto): Promise<{ status: string; message: string; data?: any }> {
    try {
      const validationResult = createUserSchema.validate(userData);
      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }
      const createdUser: any = await this.userService.createUser(userData);
      if (createdUser.firstName) {
        return {
          status: 'success',
          message: 'User created successfully',
          data: createdUser,
        };
      } else {
        throw new BadRequestException(createdUser);
      }
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Create a new user by landlord
   */
  @Post('/landlord')
  async createUserByLandLord(@Body() userData: CreateUserDto | any): Promise<{ status: string; message: string; data?: any }> {
    try {
      const validationResult = createUserByLandlordSchema.validate(userData);
      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }
      const createdUser: any = await this.userService.createUserByLandlord(userData);
      if (createdUser.firstName) {
        return {
          status: 'success',
          message: 'User created successfully',
          data: createdUser,
        };
      } else {
        throw new BadRequestException(createdUser);
      }
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get all users
   */
  @Get()
  async getUsers(): Promise<{ status: string; message: string; data: any }> {
    const users = await this.userService.findAllUsers();
    if (!users) {
      return {
        status: 'success',
        message: 'No user found',
        data: null,
      };
    } else {
      return {
        status: 'success',
        message: 'All users fetched successfully',
        data: users,
      };
    }
  }

  /**
   * Confirm user account
   */
  @Post('/confirm-account')
  async confirmAccount(@Body() body: ConfirmUserDto): Promise<any> {
    try {
      const validationResult = confirmUserSchema.validate(body);
      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }
      const result = await this.userService.confirmAccount(body);
      if (result) {
        return result;
      } else {
        throw new NotFoundException('User not found');
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      } else {
        throw new InternalServerErrorException('Failed to confirm account');
      }
    }
  }

  /**
   * Update user by ID
   */
  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  async updateUser(
    @Param('id') id: string,
    @Body() body: User,
    @UploadedFiles()
    files: {
      file?: Express.Multer.File;
    },
    @Res() res: Response,
  ) {
    try {
      const updatedUser = await this.userService.updateUser(id, {
        ...body,
        ...files,
      });
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'User updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  /**
   * Request password reset
   */
  @Post('/request-password-reset')
  async requestPasswordReset(@Body('email') email: string): Promise<{ message: string } | void> {
    const user: any = await this.userService.findUserByEmail(email);
    if (!user) {
      // You can either notify that the email was not found or just return a success message
      return;
    }
    const token = this.authService.createPasswordResetToken(user._id);
    await this.userService.savePasswordResetToken(user.email);
    return { message: 'Password reset link sent.' };
  }

  /**
   * Reset password
   */
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(token, hashedPassword);
    return { message: 'Password successfully reset.' };
  }

  /**
   * Update notification settings for a user
   */
  @Patch(':id/notification-settings')
  async updateNotificationSettings(
    @Param('id') id: string,
    @Body() settings: Partial<UpdateNotificationSettingsDto>,
  ): Promise<{ status: string; message: string; data: any }> {
    const updated = await this.userService.updateNotificationSettings(id, settings);
    return {
      status: 'success',
      message: 'Notification settings updated successfully',
      data: updated,
    };
  }

  /**
   * Verify NIN
   */
  @Post('/nin')
  async verifyBVN(@Body('nin') nin: string): Promise<any> {
    const data: any = await this.userService.verifyBVN(nin);
    if (!data) {
      return;
    }
    return data;
  }

  /**
   * Check if a user exists by email
   */
  @Get('exists')
  async userExists(@Query('email') email: string, @Body() body: any, @Body('email') emailBody?: string, @Body() query?: any): Promise<any> {
    // Support both query param and body for flexibility
    const emailToCheck = email || emailBody || (query && query.email)
    console.log({emailToCheck});
    
    if (!emailToCheck) {
      return { exists: false };
    }
    const user = await this.userService.findUserByEmail(email);
    if (user) {
      return { exists: true };
    }
    // User does not exist, create a tenant account
    const defaultPassword = Math.random().toString(36).slice(-8); // simple random password
    const newTenant = {
      firstName: 'Tenant',
      lastName: 'Account',
      email,
      password: defaultPassword,
      nin: '',
      phoneNumber: '',
      homeAddress: '',
      confirmationCode: '',
      status: 'active',
      isOnboarded: false,
      accountType: 'tenant',
    };
    console.log({newTenant});
    
    await this.userService.createUserByLandlord(newTenant);
    // Optionally, send the password to the tenant's email (handled in service)
    return { exists: false, created: true };
  }
}
