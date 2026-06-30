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
import { PlansService } from '../plans/plans.service';
const baseURL = config.web.youVerifyNinUrl;
const token = config.web.youVerifyToken;

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
    private plansService: PlansService,
  ) {}

  /**
   * Assign default (Premium) plan to a user. Used for existing users without a plan.
   */
  async assignDefaultPlan(userId: string): Promise<void> {
    const defaultPlan = await this.plansService.getDefaultPlan();
    await this.userModel.findByIdAndUpdate(userId, {
      planId: (defaultPlan as any)._id,
    });
  }

  /**
   * Update a user's plan (e.g. upgrade to Premium).
   */
  async updatePlan(userId: string, planId: string): Promise<User> {
    await this.plansService.findById(planId);
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { planId },
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user.toObject ? user.toObject() : user;
  }

  /**
   * Consume one standard verification credit. Throws if none left.
   */
  async consumeStandardVerification(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException('User not found');
    const u = user as any;
    const available = (u.standardVerificationBalance ?? 0) - (u.standardVerificationUsed ?? 0);
    console.log(`[consumeStandardVerification] userId=${userId}, balance=${u.standardVerificationBalance}, used=${u.standardVerificationUsed}, available=${available}`);
    if (available < 1) {
      throw new BadRequestException(
        'No standard verification credits left. Purchase more credits to run standard screening.',
      );
    }
    const result = await this.userModel.findByIdAndUpdate(userId, {
      $inc: { standardVerificationUsed: 1 },
    }, { new: true });
    console.log(`[consumeStandardVerification] After update: used=${(result as any)?.standardVerificationUsed}`);
  }

  /**
   * Consume one premium verification credit. Throws if none left.
   */
  async consumePremiumVerification(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException('User not found');
    const u = user as any;
    const available = (u.premiumVerificationBalance ?? 0) - (u.premiumVerificationUsed ?? 0);
    if (available < 1) {
      throw new BadRequestException(
        'No premium verification credits left. Purchase more credits to run premium screening.',
      );
    }
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { premiumVerificationUsed: 1 },
    });
  }

  /**
   * Add credits one-by-one (or in quantity) for affordability. Each field is optional.
   */
  async addCredits(
    userId: string,
    payload: { standardVerification?: number; premiumVerification?: number },
  ): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const updates: any = {};
    if (payload.standardVerification != null && payload.standardVerification > 0) {
      updates.$inc = updates.$inc || {};
      updates.$inc.standardVerificationBalance = payload.standardVerification;
    }
    if (payload.premiumVerification != null && payload.premiumVerification > 0) {
      updates.$inc = updates.$inc || {};
      updates.$inc.premiumVerificationBalance = payload.premiumVerification;
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one credit type with quantity > 0 is required.');
    }
    const updated = await this.userModel.findByIdAndUpdate(userId, updates, { new: true });
    if (!updated) throw new NotFoundException('User not found');
    return updated.toObject ? updated.toObject() : updated;
  }

  /**
   * One-time purchase: add pack credits to user balances (stackable).
   */
  async purchasePack(userId: string, planId: string): Promise<User> {
    return this.purchasePackWithQuantity(userId, planId, 1);
  }

  /**
   * Add pack credits to user balances for a given quantity (stackable).
   */
  async purchasePackWithQuantity(userId: string, planId: string, quantity: number): Promise<User> {
    const plan = await this.plansService.findById(planId) as any;
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException('User not found');
    const current = user as any;
    const qty = Math.max(1, Math.floor(quantity));
    const standardAdd = (plan.standardVerificationAdded ?? plan.verificationLimit ?? 0) * qty;
    const premiumAdd = (plan.premiumVerificationAdded ?? plan.verificationLimit ?? 0) * qty;
    const standardBalance = (current.standardVerificationBalance ?? 0) + standardAdd;
    const premiumBalance = (current.premiumVerificationBalance ?? 0) + premiumAdd;
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      {
        planId,
        standardVerificationBalance: standardBalance,
        premiumVerificationBalance: premiumBalance,
      },
      { new: true },
    );
    if (!updated) throw new NotFoundException('User not found');
    return updated.toObject ? updated.toObject() : updated;
  }

  /**
   * Find all users
   * @returns Array of users
   */
  async findAllUsers(): Promise<User[]> {
    return await this.userModel.find();
  }

  /**
   * Find all users with pagination and filtering
   * @param params
   * @returns Paginated users with metadata
   */
  async findAllUsersWithPagination(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: User[]; pagination: { total: number; page: number; limit: number } }> {
    const { page, limit, search, role, status, sortBy, sortOrder } = params;
    
    // Build query
    let query: any = {};
    
    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
        ],
      };
    }
    
    // Role filter
    if (role) {
      query.accountType = role;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Build sort object
    let sort: any = { createdAt: -1 }; // Default: most recent first
    if (sortBy) {
      sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    }
    
    // Calculate skip
    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await this.userModel.countDocuments(query);
    
    // Get paginated results
    const users = await this.userModel
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-password -confirmationCode'); // Exclude sensitive fields
    
    return {
      data: users,
      pagination: {
        total,
        page,
        limit,
      },
    };
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
    const checkExistingUserByNin = user.nin?.trim()
      ? await this.userModel.findOne({ nin: user.nin.trim() })
      : null;

    if (existingUser) {
      return { message: 'An account with this email already exists' };
    }

    if (checkExistingUserByNin && user.nin?.trim() && checkExistingUserByNin.nin?.trim()) {
      return { message: 'An account with this NIN already exists' };
    }

    user.confirmationCode = confirmationCode;
    const defaultPlan = await this.plansService.getDefaultPlan();
    (user as any).planId = (defaultPlan as any)._id;
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

        // Never let email failures crash the request/process (SMTP may be blocked in dev/hosting).
        void this.emailService.sendUserCreatedEmail(createdUser).catch((emailErr: any) => {
          console.error(
            `Welcome/verification email failed for ${createdUser?.email}:`,
            emailErr?.message || emailErr,
          );
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `[dev] Verification OTP for ${createdUser?.email}: ${confirmationCode}`,
            );
          }
        });
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
  ): Promise<User | any | { message: string; emailSent?: boolean }> {
    const confirmationCode = generateConfirmationCode();
    const existingUser = await this.userModel.findOne({ email: user.email });
    const checkExistingUserByNin = await this.userModel.findOne({
      nin: user.nin,
    });


    user.confirmationCode = confirmationCode;
    user.password = generateConfirmationCode();
    user.status = 'active';
    const defaultPlan = await this.plansService.getDefaultPlan();
    (user as any).planId = (defaultPlan as any)._id;
    const newUser = new this.userModel(user);
   console.log({user});
   
    try {
      const createdUser: any = await newUser.save();
      if (createdUser) {
        console.log({ createdUser });

        try {
          console.log(`Sending onboard/password email to ${user.email}`);
          await this.emailService.sendUserCreatedByLandlordEmail(user);
          console.log(`Onboard email sent successfully to ${user.email}`);
        } catch (emailErr: any) {
          console.error(`Onboard email failed for ${user.email}:`, emailErr?.message || emailErr);
          // Don't fail user creation - tenant can use "Forgot password" or landlord can share credentials
        }

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
   * Resend verification OTP for signup / inactive accounts.
   */
  async resendVerificationCode(email: string): Promise<{ message: string }> {
    const user = await this.findUserByEmail(email?.trim());
    if (!user) {
      throw new NotFoundException('No account with this email exists');
    }
    if (user.status === 'active') {
      throw new BadRequestException(
        'This account is already verified. You can sign in.',
      );
    }

    const confirmationCode = generateConfirmationCode();
    const updatedUser = await this.userModel
      .findOneAndUpdate(
        { email: email?.trim() },
        { $set: { confirmationCode } },
        { new: true },
      )
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('No account with this email exists');
    }

    try {
      await this.emailService.sendUserCreatedEmail(updatedUser);
      return { message: 'Verification code sent. Check your inbox.' };
    } catch (emailErr: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[dev] Verification OTP for ${updatedUser.email}: ${confirmationCode}`,
        );
        return {
          message:
            'Email could not be delivered. Check the backend console for your OTP in local development.',
        };
      }
      console.error(
        `Verification email resend failed for ${updatedUser.email}:`,
        emailErr?.message || emailErr,
      );
      throw new InternalServerErrorException(
        'Unable to send verification email right now. Please try again later.',
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

    if (!user) {
      throw new NotFoundException('No account with this email exists');
    }

    if (user.status === 'active') {
      throw new BadRequestException('Account has already been confirmed');
    }

    if (String(user.confirmationCode) !== String(confirmationCode)) {
      throw new BadRequestException('Incorrect confirmation code');
    }
    const payload = { email: user.email, sub: user['_id'] };
    const accessToken = this.jwtService.sign(payload);
    user.status = 'active';
    user.isOnboarded = false;
    await user.save();

    const safeUser = (user as any).toObject?.() ?? { ...(user as any) };
    delete safeUser.password;
    delete safeUser.confirmationCode;

    return { user: safeUser as User, accessToken };
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
    if (!user) {
      return;
    }

    const confirmationCode = generateConfirmationCode();

    await this.userModel.findByIdAndUpdate(user._id, {
      passwordResetToken: confirmationCode,
      passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour expiration
    });

    user.passwordResetToken = confirmationCode;

    try {
      await this.emailService.sendResetPasswordToken(user);
    } catch (emailErr: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[dev] Password reset code for ${email}: ${confirmationCode}`,
        );
      }
      console.error(
        `Password reset email failed for ${email}:`,
        emailErr?.message || emailErr,
      );
      throw new InternalServerErrorException(
        'Unable to send password reset email right now. Please try again later.',
      );
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
  async verifyNIN(nin: string): Promise<{ success: boolean; message: string; data?: any }> {
    if (!nin) {
      return { success: false, message: 'NIN is required.' };
    }
    try {
      // Step 1: Check if user already exists in DB
      const existingRecord = await this.userVerification.findOne({ idNumber: nin });
      if (existingRecord) {
        return { success: true, message: 'Record already exists in database.', data: existingRecord };
      }
      // Step 2: Call external API
      const body = { id: nin, isSubjectConsent: true };
      const response = await axios.post(baseURL, body, { headers });
      const data = response.data?.data;
      // Step 3: Save to DB
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
      return { success: true, message: 'Verification successful and data saved.', data: saved };
    } catch (error) {
      console.error('NIN verification error:', error);
      return { success: false, message: 'Verification failed. Please try again later.' };
    }
  }

  /**
   * Send user created by landlord email with password
   */
  async sendUserCreatedByLandlordEmailWithPassword(user: any, password: string): Promise<void> {
    await this.emailService.sendUserCreatedByLandlordEmail({ ...user, password });
  }
}
