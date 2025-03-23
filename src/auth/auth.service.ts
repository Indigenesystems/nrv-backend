import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/users.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from 'src/properties/entities/application.entity';
import { Property } from 'src/properties/entities/property.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { NotificationSettings } from '../users/entities/notificationSettings.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(NotificationSettings.name) private readonly notificationSettingsModel: Model<NotificationSettings>,
    private userService: UserService,
    private jwtService: JwtService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findUserByEmail(email);

    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    return null;
  }

  async login(loginUserDto: LoginUserDto): Promise<{ user: User; accessToken: string; notificationSettings: NotificationSettings } | any> {

    const user: any = await this.validateUser(loginUserDto.email, loginUserDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if(user.status === "inactive"){
        return {user}
    }
    const notificationSettings = await this.notificationSettingsModel.findOne({userId: user._id});
    const payload = { email: user.email, sub: user["_id"] };
    const accessToken = this.jwtService.sign(payload);
    return { user, accessToken , notificationSettings};
  }

  async generateToken(email: string){
    const user = await this.userService.findUserByEmail(email);
    const payload = { email: user.email, sub: user["_id"] };
    const accessToken = this.jwtService.sign(payload);
    return { user, accessToken };
  }

  createPasswordResetToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      expiresIn: '1h', // or any desired expiration time
    });
  }

  async validatePasswordResetToken(token: string): Promise<string> {
    try {
      const payload = this.jwtService.verify(token);
      return payload.sub; // This should be the user ID
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}


