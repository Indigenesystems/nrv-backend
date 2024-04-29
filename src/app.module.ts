import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongodbModule } from './db/db.module';
import { UserSchema } from './users/entities/user.entity';
import { UserController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { UserService } from './users/users.service';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtModule } from '@nestjs/jwt'; // Import JwtModule only
import { EmailService } from './email-sender/email.service';
import { EmailServiceModule } from './email-sender/email-sender.module';

@Module({
  imports: [
    MongodbModule,
    UsersModule,
    EmailServiceModule,
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    JwtModule.register({
      secret: 'your-secret-key-here', // Provide your secret key here
      signOptions: { expiresIn: '1d' }, // Optional: Set token expiration time
    }),
    AuthModule,
  ],
  controllers: [AppController, UserController, AuthController],
  providers: [AppService, UserService, AuthService, EmailService], 
})
export class AppModule {}
