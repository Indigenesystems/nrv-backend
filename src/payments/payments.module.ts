import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaystackService } from './paystack.service';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './entities/payment.entity';
import { UsersModule } from '../users/users.module';
import { PlansModule } from '../plans/plans.module';
import { EmailService } from '../email-sender/email.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    HttpModule,
    UsersModule,
    PlansModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [PaymentsController],
  providers: [PaystackService, PaymentsService, EmailService],
})
export class PaymentsModule {}
