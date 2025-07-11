import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationSchema } from './entities/verification.entity';
import { EmailService } from 'src/email-sender/email.service';
import { VerificationResponseSchema } from './entities/verification-response.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Verification", schema: VerificationSchema },
            { name: "VerificationResponse", schema: VerificationResponseSchema },

    ]),
  ],
  controllers: [VerificationController],
  providers: [VerificationService, EmailService, CloudinaryService],
})
export class VerificationModule {}
