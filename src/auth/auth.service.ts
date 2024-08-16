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

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
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

  async login(loginUserDto: LoginUserDto): Promise<{ user: User; accessToken: string }> {

    const user = await this.validateUser(loginUserDto.email, loginUserDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if(user.status === "inactive"){
        throw new UnauthorizedException('Kindly confirm you account');
    }
    const payload = { email: user.email, sub: user["_id"] };
    const accessToken = this.jwtService.sign(payload);
    return { user, accessToken };
  }

  async generateToken(email: string){
    const user = await this.userService.findUserByEmail(email);
    const payload = { email: user.email, sub: user["_id"] };
    const accessToken = this.jwtService.sign(payload);
    return { user, accessToken };
  }
}


