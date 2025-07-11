import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { generateConfirmationCode } from '../helper/utils';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';
import { PropertiesService } from '../properties/properties.service';
import { Application } from '../properties/entities/application.entity';
import { Room } from '../rooms/entities/room.entity';
import { Property } from '../properties/entities/property.entity';
import { NotificationSettings } from './entities/notificationSettings.entity';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';


import config from 'src/config/config';
import axios from 'axios';
import { UserVerification } from './entities/userVerification';
const baseURL = config.web.youVerifyNIN;
const token = config.web.token;

const headers = {
    "token": `${token}`,
    "Content-Type": "application/json"
};
@Injectable()
export class UserService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(UserVerification.name) private readonly userVerification: Model<UserVerification>,
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(NotificationSettings.name)
    private readonly notificationSettingsModel: Model<NotificationSettings>,
    @InjectModel(AgreementDocuments.name)
    private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private propertiesService: PropertiesService,
    private cloudinaryService: CloudinaryService,
    
  ) {}

  /**
   * Find all users
   * @returns Array of users
   */
  async findAllUsers(): Promise<User[]> {
    return await this.userModel.find();
  }

  /**
   * Find user by ID
   * @param id
   * @returns User or null
   */
  async findUserById(id: string): Promise<User | null> {
    return await this.userModel.findById(id);
  }

  /**
   * Find user by email
   * @param email
   * @returns User or null
   */
  async findUserByEmail(email: string): Promise<User | null> {
    console.log({email});
    
    return await this.userModel.findOne({ email });
  }

  /**
   * Find user by NIN
   * @param nin
   * @returns User or null
   */
  async findUserByNin(nin: string): Promise<User | null> {
    return await this.userModel.findOne({ nin });
  }

  /**
   * Create a new user
   * @param user
   * @returns Created user or error message
   */
  async createUser(user: User): Promise<User | { message: string }> {
    const confirmationCode = generateConfirmationCode();
    const existingUser = await this.userModel.findOne({ email: user.email });
    const checkExistingUserByNin = await this.userModel.findOne({
      nin: user.nin,
    });

    if (existingUser) {
      return { message: 'An account with this email already exists' };
    }

    if (checkExistingUserByNin && checkExistingUserByNin.nin != '') {
      return { message: 'An account with this NIN already exists' };
    }

    user.confirmationCode = confirmationCode;
    const newUser = new this.userModel(user);

    try {
      const createdUser = await newUser.save();

      if (createdUser) {
        // Create notification settings for the new user
        const notificationSettings = new this.notificationSettingsModel({
          userId: createdUser._id,
          platformUpdates: true, // default values
          promotions: true,
          weeklyOpportunities: true,
          feedbackOpportunities: true,
          maintenanceUpdates: true,
          messagePreference: 'all', // default preference
        });
        await notificationSettings.save();

        this.emailService.sendUserCreatedEmail(createdUser);
      }
      return createdUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new InternalServerErrorException(
        'Failed to create user. Please try again later.',
      );
    }
  }

  /**
   * Create a new user by landlord
   * @param user
   * @returns Created user or error message
   */
  async createUserByLandlord(
    user: any,
  ): Promise<User | any | { message: string }> {
    const confirmationCode = generateConfirmationCode();
    const existingUser = await this.userModel.findOne({ email: user.email });
    const checkExistingUserByNin = await this.userModel.findOne({
      nin: user.nin,
    });



    user.confirmationCode = confirmationCode;
    user.password = generateConfirmationCode();
    user.status = 'active';
    const newUser = new this.userModel(user);
   console.log({user});
   
    try {
      const createdUser: any = await newUser.save();
      if (createdUser) {
        console.log({ createdUser });

        await this.emailService.sendUserCreatedByLandlordEmail(user);

        // Create notification settings for the new user
        const notificationSettings = new this.notificationSettingsModel({
          userId: createdUser._id,
          platformUpdates: true, // default values
          promotions: true,
          weeklyOpportunities: true,
          feedbackOpportunities: true,
          maintenanceUpdates: true,
          messagePreference: 'all', // default preference
        });
        await notificationSettings.save();

        const formattedPayload = {
          ...user,
          applicant: createdUser._id,
          
        };
        await this.propertiesService.mapCreatedUserToApartment(
          formattedPayload,
        );
      }
      return createdUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new InternalServerErrorException(
        'Failed to create user. Please try again later.',
      );
    }
  }

  /**
   * Confirm user account
   * @param body
   * @returns User and access token or throws
   */
  async confirmAccount(body: any): Promise<{ user: User; accessToken: string }> {
    const { email, confirmationCode } = body;
    const user = await this.userModel.findOne({ email });

    if (user.status === 'active') {
      throw new BadRequestException('Account has already been confirmed');
    }

    if (!user) {
      throw new NotFoundException('No account with this email exist');
    }

    if (user.confirmationCode != confirmationCode) {
      throw new BadRequestException('Incorrect confirmation code');
    }
    const payload = { email: user.email, sub: user['_id'] };
    const accessToken = this.jwtService.sign(payload);
    user.status = 'active';
    user.isOnboarded = false;
    await user.save();
    return { user, accessToken };
  }

  /**
   * Update user by ID
   * @param id
   * @param updatedUser
   * @returns Updated user
   */
  async updateUser(id: string, updatedUser: any): Promise<User> {
    let fileUrl: string | undefined;
    if (updatedUser.file && updatedUser.file.length > 0) {
      fileUrl = await this.cloudinaryService.upload(updatedUser.file[0]);
      console.log({ fileUrl });
    }

    const updateData = { ...updatedUser, file: fileUrl };

    console.log({ updateData });

    return await this.userModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
  }

  /**
   * Save password reset token for a user
   * @param email
   */
  async savePasswordResetToken(email: string): Promise<void> {
    const user: any = await this.findUserByEmail(email);
    const confirmationCode = generateConfirmationCode();
    const _user = { ...user, passwordResetToken: confirmationCode };

    await this.userModel.findByIdAndUpdate(user._id, {
      passwordResetToken: confirmationCode,
      passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour expiration
    });

    if (user) {
      this.emailService.sendResetPasswordToken(_user);
    }
  }

  /**
   * Update password for a user
   * @param token
   * @param hashedPassword
   */
  async updatePassword(token: string, hashedPassword: string): Promise<void> {
    try {
      const user: any = await this.userModel.findOne({
        passwordResetToken: token,
      });
      if (user.passwordResetToken === token && user) {
        await this.userModel.findByIdAndUpdate(user._id, {
          password: hashedPassword,
          passwordResetToken: null, // Invalidate the token
          passwordResetExpires: null,
        });
      } else {
        throw new InternalServerErrorException(
          'Failed to update password. Please try again later.',
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to update password. Please try again later.',
      );
    }
  }

  async invalidatePasswordResetToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  }

  /**
   * Update notification settings for a user
   * @param userId
   * @param settings
   * @returns Updated notification settings
   */
  async updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    const updatedSettings =
      await this.notificationSettingsModel.findOneAndUpdate(
        { userId },
        settings,
        { new: true },
      );

    if (!updatedSettings) {
      throw new NotFoundException(
        'Notification settings not found for this user',
      );
    }

    return updatedSettings;
  }

  /**
   * Verify NIN
   * @param nin
   * @returns Verification data or null
   */
  async verifyBVN(nin: string): Promise<any> {
    if (!nin) {
        throw new Error('NIN is required to perform verification');
    }

    // Step 1: Check if user already exists in DB
    const existingRecord = await this.userVerification.findOne({ idNumber: nin });

    if (existingRecord) {
        return {
            message: 'Record already exists in database.',
            data: existingRecord,
        };
    }

    const body = {
        id: nin,
        isSubjectConsent: true,
    };

    try {
        const response = await axios.post(baseURL, body, { headers });
        const data = response.data?.data;

        // Step 2: Save to DB if not already present
        const saved = await this.userVerification.create({
            id: data.id,
            firstName: data.firstName,
            lastName: data.lastName,
            middleName: data.middleName,
            image: data.image,
            mobile: data.mobile,
            email: data.email,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth,
            idNumber: data.idNumber,
            type: data.type,
            address: data.address,
            birthState: data.birthState,
            birthLGA: data.birthLGA,
            birthCountry: data.birthCountry,
            nokState: data.nokState,
            religion: data.religion,
            isConsent: data.isConsent,
            country: data.country,
            status: data.status,
            createdAt: data.createdAt,
            lastModifiedAt: data.lastModifiedAt,
            requestedAt: data.requestedAt,
            requestedBy: data.requestedBy,
            businessId: data.businessId,
            allValidationPassed: data.allValidationPassed,
            dataValidation: data.dataValidation,
            selfieValidation: data.selfieValidation,
        });

        return {
            message: 'Verification successful and data saved.',
            data: saved,
        };

    } catch (error) {
        const errorResponse = error.response?.data;

        if (errorResponse) {
            switch (errorResponse.statusCode) {
                case 402:
                    throw {
                        statusCode: 402,
                        text: "insufficient funds. Please top up your account",
                        message: "We are currently unable to complete your request. Please try again later.",
                    };
                case 403:
                    throw {
                        statusCode: 403,
                        text: "permission error, check access token",
                        message: "We are unable to verify your information at the moment. Please contact support for assistance.",
                    };
                case 503:
                    throw {
                        statusCode: 503,
                        message: "Third-party service is currently unavailable. Please try again later.",
                    };
                case 500:
                    throw {
                        statusCode: 500,
                        message: "Internal server error. Please contact support.",
                    };
                default:
                    throw {
                        statusCode: errorResponse.statusCode || 500,
                        message: errorResponse.message || "An unknown error occurred during BVN verification.",
                    };
            }
        } else {
            throw {
                statusCode: 500,
                message: error.message || "An unexpected error occurred during BVN verification.",
            };
        }
    }
  }

  /**
   * Send user created by landlord email with password
   */
  async sendUserCreatedByLandlordEmailWithPassword(user: any, password: string): Promise<void> {
    await this.emailService.sendUserCreatedByLandlordEmail({ ...user, password });
  }
}
