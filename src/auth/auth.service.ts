import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/users.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from 'src/properties/entities/property.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { NotificationSettings } from '../users/entities/notificationSettings.entity';
import { EmailService } from 'src/email-sender/email.service';
import {
  RememberMeToken,
  RememberMeTokenDocument,
} from './entities/remember-me-token.entity';
import {
  ACCESS_TOKEN_REMEMBER_EXPIRES,
  ACCESS_TOKEN_SHORT_EXPIRES,
  generateRememberMeRawToken,
  hashRememberMeToken,
  REMEMBER_ME_TTL_MS,
} from './remember-me.constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(NotificationSettings.name)
    private readonly notificationSettingsModel: Model<NotificationSettings>,
    @InjectModel(RememberMeToken.name)
    private readonly rememberMeTokenModel: Model<RememberMeTokenDocument>,
    private userService: UserService,
    private jwtService: JwtService,
    private cloudinaryService: CloudinaryService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findUserByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  private sanitizeUserForClient(user: any): User {
    const plain =
      typeof user?.toObject === 'function' ? user.toObject() : { ...user };
    delete plain.password;
    delete plain.confirmationCode;
    delete plain.passwordResetToken;
    delete plain.passwordResetExpires;
    return plain;
  }

  private async createSessionForUser(user: any, rememberMe = false) {
    if (!user.planId) {
      await this.userService.assignDefaultPlan(user._id.toString());
    }

    const notificationSettings = await this.notificationSettingsModel.findOne({
      userId: user._id,
    });
    const expiresIn = rememberMe
      ? ACCESS_TOKEN_REMEMBER_EXPIRES
      : ACCESS_TOKEN_SHORT_EXPIRES;
    const payload = { email: user.email, sub: String(user['_id']) };
    const accessToken = this.jwtService.sign(payload, { expiresIn });
    const safeUser = this.sanitizeUserForClient(user);

    return { user: safeUser, accessToken, notificationSettings };
  }

  async login(
    loginUserDto: LoginUserDto,
    options?: { userAgent?: string },
  ): Promise<{
    user: User;
    accessToken: string;
    notificationSettings: NotificationSettings | null;
    rememberMeRawToken?: string;
  }> {
    const user: any = await this.validateUser(
      loginUserDto.email,
      loginUserDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accountStatus = String(user.status || '').toLowerCase();
    if (accountStatus === 'suspended') {
      throw new UnauthorizedException(
        user.statusReason
          ? `Your account has been suspended: ${user.statusReason}`
          : 'Your account has been suspended. Please contact support.',
      );
    }
    if (accountStatus === 'deactivated') {
      throw new UnauthorizedException(
        user.statusReason
          ? `Your account has been deactivated: ${user.statusReason}`
          : 'Your account has been deactivated. Please contact support.',
      );
    }

    const rememberMe = Boolean(loginUserDto.rememberMe);
    const session = await this.createSessionForUser(user, rememberMe);

    if (user.status === 'inactive') {
      try {
        await this.userService.resendVerificationCode(user.email);
      } catch (emailErr: any) {
        console.error(
          `Verification email resend failed for ${user?.email}:`,
          emailErr?.message || emailErr,
        );
      }
      return session;
    }

    if (rememberMe) {
      const rememberMeRawToken = await this.createRememberMeToken(
        String(user._id),
        options?.userAgent,
      );
      return { ...session, rememberMeRawToken };
    }

    return session;
  }

  async createRememberMeToken(
    userId: string,
    userAgent?: string,
  ): Promise<string> {
    const rawToken = generateRememberMeRawToken();
    const tokenHash = hashRememberMeToken(rawToken);
    const expiresAt = new Date(Date.now() + REMEMBER_ME_TTL_MS);

    await this.rememberMeTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash,
      expiresAt,
      userAgent: userAgent || null,
      lastUsedAt: new Date(),
      revoked: false,
    });

    return rawToken;
  }

  async revokeRememberMeToken(rawToken: string): Promise<void> {
    if (!rawToken) {
      return;
    }
    const tokenHash = hashRememberMeToken(rawToken);
    await this.rememberMeTokenModel.updateOne(
      { tokenHash, revoked: false },
      { $set: { revoked: true } },
    );
  }

  async revokeAllRememberMeTokensForUser(userId: string): Promise<void> {
    await this.rememberMeTokenModel.updateMany(
      { userId: new Types.ObjectId(userId), revoked: false },
      { $set: { revoked: true } },
    );
  }

  /**
   * Exchange a valid remember-me cookie token for a fresh access session.
   */
  async loginWithRememberMeToken(rawToken: string): Promise<{
    user: User;
    accessToken: string;
    notificationSettings: NotificationSettings | null;
  }> {
    if (!rawToken) {
      throw new UnauthorizedException('No remember-me token');
    }

    const tokenHash = hashRememberMeToken(rawToken);
    const record = await this.rememberMeTokenModel.findOne({
      tokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired remember-me token');
    }

    const user: any = await this.userService.findUserById(
      String(record.userId),
    );
    if (
      !user ||
      user.status === 'inactive' ||
      user.status === 'suspended' ||
      user.status === 'deactivated'
    ) {
      await this.revokeRememberMeToken(rawToken);
      throw new UnauthorizedException('Unable to restore session');
    }

    record.lastUsedAt = new Date();
    await record.save();

    return this.createSessionForUser(user, true);
  }

  async generateToken(email: string) {
    const user = await this.userService.findUserByEmail(email);
    const payload = { email: user.email, sub: String(user['_id']) };
    const accessToken = this.jwtService.sign(payload);
    return { user, accessToken };
  }

  createPasswordResetToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      expiresIn: '1h',
    });
  }

  async validatePasswordResetToken(token: string): Promise<string> {
    try {
      const payload = this.jwtService.verify(token);
      return payload.sub;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
