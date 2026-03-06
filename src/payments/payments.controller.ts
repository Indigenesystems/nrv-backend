import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { PaymentsService } from './payments.service';
import { UserService } from '../users/users.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paystackService: PaystackService,
    private readonly paymentsService: PaymentsService,
    private readonly userService: UserService,
  ) {}

  /**
   * Initialize a Paystack transaction to purchase a pack (5 credits).
   * Body: { userId, planId, amountNaira }
   */
  @Post('initialize-pack')
  async initializePack(
    @Body()
    body: { userId: string; planId: string; amountNaira: number; quantity?: number },
  ) {
    const { userId, planId, amountNaira, quantity = 1 } = body;

    const user = await this.userService.findUserById(userId);
    if (!user) {
      return { status: 'error', message: 'User not found' };
    }

    const reference = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const callbackUrl =
      process.env.PAYSTACK_CALLBACK_URL ||
      'https://www.naijarentverify.com/payments/callback';

    const data = await this.paystackService.initializeTransaction({
      email: (user as any).email,
      amountNaira,
      reference,
      callbackUrl,
      metadata: {
        userId,
        planId,
        type: 'pack',
      },
    });

    await this.paymentsService.createPayment({
      userId,
      planId,
      type: 'pack',
      reference,
      amountNaira,
      amountKobo: Math.round(amountNaira * 100),
      quantity,
    });

    return {
      status: 'success',
      message: 'Authorization URL created',
      data,
    };
  }

  /**
   * Verify a Paystack transaction and award credits.
   * Param: reference
   */
  @Post('verify/:reference')
  async verify(@Param('reference') reference: string) {
    const result = await this.paystackService.verifyTransaction(reference);
    const paymentRecord = await this.paymentsService.findByReference(reference);

    if (!result?.status || result.data?.status !== 'success') {
      if (paymentRecord) {
        await this.paymentsService.updatePaymentStatus(reference, 'failed');
      }
      return { status: 'error', message: 'Payment not successful' };
    }

    if (paymentRecord) {
      await this.paymentsService.updatePaymentStatus(
        reference,
        'success',
        new Date(),
      );
    }

    const meta = result.data?.metadata || {};
    const { userId, planId, type } = meta as {
      userId?: string;
      planId?: string;
      type?: string;
    };

    if (type === 'pack' && userId && planId && paymentRecord) {
      const quantity = (paymentRecord as any).quantity ?? 1;
      await this.userService.purchasePackWithQuantity(userId, planId, quantity);
    }

    return {
      status: 'success',
      message: 'Payment verified and credits added.',
    };
  }

  /**
   * Get payment and purchase history for a user.
   */
  @Get('history/:userId')
  async getHistory(@Param('userId') userId: string) {
    const payments = await this.paymentsService.findByUser(userId);
    return {
      status: 'success',
      data: payments,
    };
  }
}

