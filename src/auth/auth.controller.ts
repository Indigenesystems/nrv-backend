import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { loginUserSchema } from 'src/validations/validator';
import {
  getClearRememberMeCookieOptions,
  getRememberMeCookieOptions,
  REMEMBER_ME_COOKIE,
} from './remember-me.constants';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const validationResult = loginUserSchema.validate(loginUserDto);
    if (validationResult.error) {
      throw new BadRequestException(validationResult.error.message);
    }

    const result = await this.authService.login(loginUserDto, {
      userAgent: req.headers['user-agent'],
    });
    const { rememberMeRawToken, ...payload } = result as any;

    if (rememberMeRawToken) {
      res.cookie(
        REMEMBER_ME_COOKIE,
        rememberMeRawToken,
        getRememberMeCookieOptions(),
      );
    } else if (!loginUserDto.rememberMe) {
      const existing = req.cookies?.[REMEMBER_ME_COOKIE] as string | undefined;
      if (existing) {
        await this.authService.revokeRememberMeToken(existing);
      }
      res.clearCookie(REMEMBER_ME_COOKIE, getClearRememberMeCookieOptions());
    }

    return payload;
  }

  /**
   * Restore a short-lived access session from the httpOnly remember-me cookie.
   */
  @Get('session')
  async session(@Req() req: Request) {
    const rawToken = req.cookies?.[REMEMBER_ME_COOKIE] as string | undefined;
    if (!rawToken) {
      throw new UnauthorizedException('No remember-me session');
    }
    return this.authService.loginWithRememberMeToken(rawToken);
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REMEMBER_ME_COOKIE] as string | undefined;
    if (rawToken) {
      await this.authService.revokeRememberMeToken(rawToken);
    }
    res.clearCookie(REMEMBER_ME_COOKIE, getClearRememberMeCookieOptions());
    return { success: true };
  }
}
