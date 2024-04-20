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

@Module({
  imports: [
    MongodbModule,
    UsersModule,
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    JwtModule.register({
      secret: 'your-secret-key-here', // Provide your secret key here
      signOptions: { expiresIn: '1d' }, // Optional: Set token expiration time
    }),
    AuthModule,
  ],
  controllers: [AppController, UserController, AuthController],
  providers: [AppService, UserService, AuthService], // Remove JwtService from providers
})
export class AppModule {}
