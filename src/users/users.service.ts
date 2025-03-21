import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { generateConfirmationCode } from '../helper/utils';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';
import { PropertiesService } from '../properties/properties.service';
import { Application } from '../properties/entities/application.entity';
import { Room } from '../rooms/entities/room.entity';
import { Property } from '../properties/entities/property.entity';
import { NotificationSettings } from './entities/notificationSettings.entity';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';


@Injectable()
export class UserService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Application.name) private readonly applicationModel: Model<Application>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(NotificationSettings.name) private readonly notificationSettingsModel: Model<NotificationSettings>,
    @InjectModel(AgreementDocuments.name) private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private propertiesService: PropertiesService,
    private cloudinaryService: CloudinaryService,

  ) { }

  async findAllUsers(): Promise<User[]> {
    return await this.userModel.find();
  }

  async findUserById(id: string): Promise<User> {
    return await this.userModel.findById(id);
  }

  async findUserByEmail(email: string): Promise<User> {
    return await this.userModel.findOne({ email });
  }

  async findUserByNin(nin: string): Promise<User> {
    return await this.userModel.findOne({ nin });
  }

  async createUser(user: User): Promise<User | any | { message: string }> {
    const confirmationCode = generateConfirmationCode();
    const existingUser = await this.userModel.findOne({ email: user.email });
    const checkExistingUserByNin = await this.userModel.findOne({ nin: user.nin });

    if (existingUser) {
      return { message: 'An account with this email already exists' };
    }

    if (checkExistingUserByNin && checkExistingUserByNin.nin != "") {
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

  async createUserByLandlord(user: any): Promise<User | any | { message: string }> {
    const confirmationCode = generateConfirmationCode();
    const existingUser = await this.userModel.findOne({ email: user.email });
    const checkExistingUserByNin = await this.userModel.findOne({ nin: user.nin });
    
    if (existingUser) {
      return { message: 'An account with this email already exists' };
    }
    if (checkExistingUserByNin) {
      return { message: 'An account with this NIN already exists' };
    }

    const isPropertyMapped = await this.propertiesService.isPropertyMappedToActiveTenant(user.propertyId);
    if (isPropertyMapped) {
      return { message: 'This property has an active occupant' };
    }

    user.confirmationCode = confirmationCode;
    user.password = generateConfirmationCode();
    user.status = 'active';
    const newUser = new this.userModel(user);

    try {
      const createdUser: any = await newUser.save();
      if (createdUser) {
        console.log({createdUser});
        
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
        await this.propertiesService.mapCreatedUserToApartment(formattedPayload);
      }
      return createdUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new InternalServerErrorException(
        'Failed to create user. Please try again later.',
      );
    }
  }

  async confirmAccount(body: any): Promise<any> {

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
    const payload = { email: user.email, sub: user["_id"] };
    const accessToken = this.jwtService.sign(payload);
    user.status = 'active';
    user.isOnboarded = false;
    await user.save();
    return { user, accessToken };
  }

  async updateUser(id: string, updatedUser: any): Promise<User> {

    let fileUrl: string | undefined;
    if (updatedUser.file && updatedUser.file.length > 0) {
        fileUrl = await this.cloudinaryService.upload(updatedUser.file[0]);
        console.log({fileUrl});
        
    }

    const updateData = { ...updatedUser, profilePicture: fileUrl };

    console.log({updateData});
    
    return await this.userModel.findByIdAndUpdate(id, updateData, { new: true });
}


  
  async savePasswordResetToken(email: string, token: string): Promise<void> {
    let user:any =  await this.findUserByEmail(email)
    const confirmationCode = generateConfirmationCode();
   let _user = {...user, passwordResetToken: confirmationCode }

    await this.userModel.findByIdAndUpdate(user._id, {
      passwordResetToken: confirmationCode,
      passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour expiration
    });

    if (user) {
      console.log("here");
      
      this.emailService.sendResetPasswordToken(_user)
    }
  }

  async updatePassword(token: string, hashedPassword: string): Promise<void> {
try {
  let user:any =  await this.userModel.findOne({passwordResetToken: token})
  if (user.passwordResetToken === token && user) {
    await this.userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordResetToken: null, // Invalidate the token
      passwordResetExpires: null,
    });
  } else {
    throw new InternalServerErrorException("Failed to update password. Please try again later.");
  }
} catch (error) {
  throw new InternalServerErrorException("Failed to update password. Please try again later.");
}

  }

  async invalidatePasswordResetToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  }
  
  async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const updatedSettings = await this.notificationSettingsModel.findOneAndUpdate(
      { userId },
      settings,
      { new: true }
    );

    if (!updatedSettings) {
      throw new NotFoundException('Notification settings not found for this user');
    }

    return updatedSettings;
  }

}
