import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { PaymentsService } from './payments.service';
import { UserService } from '../users/users.service';
import { PlansService, UNIT_PRICE_NAIRA } from '../plans/plans.service';

/** Where landlords start a tenant verification after buying credits. */
export const LANDLORD_VERIFICATION_REQUEST_PATH =
  '/dashboard/landlord/properties/verification/request';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paystackService: PaystackService,
    private readonly paymentsService: PaymentsService,
    private readonly userService: UserService,
    private readonly plansService: PlansService,
  ) {}

  /**
   * Initialize a Paystack transaction to purchase verification credits (quantity × unit price).
   * Body: { userId, planId, amountNaira, quantity }
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

    let plan: any;
    try {
      plan = await this.plansService.findById(planId);
    } catch {
      return { status: 'error', message: 'Plan not found' };
    }

    const qty = Math.max(1, Math.floor(Number(quantity)));
    const unitPrice =
      plan.unitPriceNaira ??
      (plan.slug === 'premium' ? UNIT_PRICE_NAIRA.premium : UNIT_PRICE_NAIRA.standard);
    const expected = qty * unitPrice;
    if (Math.abs(Number(amountNaira) - expected) > 0.01) {
      return {
        status: 'error',
        message: `Invalid amount. Expected ₦${expected} for ${qty} credit(s) at ₦${unitPrice} each.`,
      };
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
      authorizationUrl: data.authorization_url,
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
    const psStatus = result?.data?.status as string | undefined;
    const alreadyCredited = paymentRecord?.status === 'success';

    if (!result?.status || psStatus !== 'success') {
      const resumable = this.paymentsService.isPaystackStatusResumable(psStatus);
      if (paymentRecord && !resumable && psStatus && ['failed', 'reversed'].includes(psStatus)) {
        await this.paymentsService.updatePaymentStatus(reference, 'failed');
      }
      return {
        status: 'error',
        message: resumable
          ? 'Payment was not completed. You can continue from purchase history.'
          : 'Payment not successful',
        code: resumable ? 'payment_incomplete' : 'payment_failed',
        data: resumable ? { reference, resumable: true } : undefined,
      };
    }

    if (paymentRecord && !alreadyCredited) {
      await this.paymentsService.fulfillSuccessfulPayment(paymentRecord);
    }

    const record = paymentRecord as any;
    const userId = record?.userId?.toString?.() ?? record?.userId;

    let updatedUser = null;
    if (userId) {
      try {
        updatedUser = await this.userService.findUserById(userId);
        if (updatedUser && (updatedUser as any).password) {
          delete (updatedUser as any).password;
        }
      } catch {
        // ignore
      }
    }

    return {
      status: 'success',
      message: 'Payment verified and credits added.',
      data: {
        user: updatedUser,
        verificationRequestUrl: LANDLORD_VERIFICATION_REQUEST_PATH,
      },
    };
  }

  /**
   * Get payment and purchase history for a user (paginated, newest first).
   */
  @Get('history/:userId')
  async getHistory(
    @Param('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const result = await this.paymentsService.findByUserPaginated(userId, {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
    });
    return {
      status: 'success',
      data: result.data,
      pagination: result.pagination,
    };
  }

  /**
   * Latest incomplete payment the user can resume (within the pending window).
   */
  @Get('pending/:userId')
  async getPending(@Param('userId') userId: string) {
    const payment = await this.paymentsService.findLatestPendingPayment(userId);
    return {
      status: 'success',
      data: payment,
    };
  }

  /**
   * Resume an abandoned Paystack checkout (within the pending window).
   */
  @Post('resume/:reference')
  async resume(
    @Param('reference') reference: string,
    @Body() body: { userId: string },
  ) {
    const { userId } = body;
    if (!userId) {
      return { status: 'error', message: 'userId is required' };
    }

    const outcome = await this.paymentsService.resumePayment(reference, userId);

    if (outcome.kind === 'already_paid') {
      return {
        status: 'success',
        message: 'Payment already completed',
        data: { alreadyPaid: true },
      };
    }

    if (outcome.kind === 'expired') {
      return {
        status: 'error',
        message:
          'This payment has expired. Please start a new purchase.',
        code: 'payment_expired',
      };
    }

    if (outcome.kind === 'verify') {
      return this.verify(outcome.reference);
    }

    return {
      status: 'success',
      message: 'Continue payment',
      data: { authorization_url: outcome.authorization_url },
    };
  }
}

