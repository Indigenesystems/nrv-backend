import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationSchema } from './entities/verification.entity';
import { EmailService } from 'src/email-sender/email.service';
import { VerificationResponseSchema } from './entities/verification-response.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { HttpModule } from '@nestjs/axios';
import { VerificationHistory, VerificationHistorySchema } from './entities/verification-history.entity';
import { UsersModule } from '../users/users.module';
import { DojahTierService } from './dojah-tier.service';
import { PlansModule } from '../plans/plans.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PlansModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: "Verification", schema: VerificationSchema },
      { name: "VerificationResponse", schema: VerificationResponseSchema },
      { name: VerificationHistory.name, schema: VerificationHistorySchema },
    ]),
    HttpModule,
    UsersModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService, EmailService, CloudinaryService, DojahTierService],
  exports: [DojahTierService],
})
export class VerificationModule {}
