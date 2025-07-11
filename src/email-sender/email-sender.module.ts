import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email-sender/email.service';


@Module({
  controllers: [],
  providers: [EmailService],
})
export class EmailServiceModule {}
