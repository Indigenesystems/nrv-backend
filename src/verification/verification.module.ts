import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationSchema } from './entities/verification.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Verification", schema: VerificationSchema },

    ]),
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
