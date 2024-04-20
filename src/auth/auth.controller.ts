import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { loginUserSchema } from 'src/validations/validator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto): Promise<{ accessToken: string }> {
    const validationResult = loginUserSchema.validate(loginUserDto);
    if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }
    return this.authService.login(loginUserDto);
  }
}
