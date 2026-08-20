import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from './entities/activity.entity';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { User, UserSchema } from '../users/entities/user.entity';
import { Property, PropertySchema } from '../properties/entities/property.entity';
import {
  Verification,
  VerificationSchema,
} from '../verification/entities/verification.entity';
import { Payment, PaymentSchema } from '../payments/entities/payment.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Verification.name, schema: VerificationSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
