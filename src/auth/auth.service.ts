import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/users.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
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


