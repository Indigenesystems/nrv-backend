import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { generateConfirmationCode } from '../helper/utils';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';


@Injectable()
export class UserService {
  constructor(
  @InjectModel(User.name) private readonly userModel: Model<User>, 
  private jwtService: JwtService,
  private emailService: EmailService
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

  async createUser(user: User): Promise<User | any | { message: string }> {

    const confirmationCode = generateConfirmationCode();

    const existingUser = await this.userModel.findOne({ email: user.email });

    if (existingUser) {
      return { message: "An account with this email already exists" };
    }
    user.confirmationCode = confirmationCode;

    const newUser = new this.userModel(user);

    try {
      const createdUser = await newUser.save();

      if(createdUser) {
        this.emailService.sendUserCreatedEmail(createdUser)
      }
      return createdUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw new InternalServerErrorException("Failed to create user. Please try again later.");
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
    return {user, accessToken};
  }

  async updateUser(id: string, updatedUser: User): Promise<User> {
    return await this.userModel.findByIdAndUpdate(id, updatedUser, { new: true });
  }
}
