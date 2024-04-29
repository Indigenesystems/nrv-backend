import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { User, UserSchema } from './entities/user.entity'; // Import User and UserSchema
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),  // Register UserSchema
  ],
  controllers: [UserController],
  providers: [UserService, AuthService, JwtService, EmailService],
})
export class UsersModule {}