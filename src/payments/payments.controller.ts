import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
    const alreadyCredited = paymentRecord?.status === 'success';

    if (!result?.status || result.data?.status !== 'success') {
      if (paymentRecord) {
        await this.paymentsService.updatePaymentStatus(reference, 'failed');
      }
      return { status: 'error', message: 'Payment not successful' };
    }

    if (paymentRecord && !alreadyCredited) {
      await this.paymentsService.updatePaymentStatus(
        reference,
        'success',
        new Date(),
      );
    }

    // Use our payment record for userId/planId (Paystack metadata can be stringified or missing)
    const record = paymentRecord as any;
    const userId = record?.userId?.toString?.() ?? record?.userId;
    const planId = record?.planId?.toString?.() ?? record?.planId;
    const type = record?.type ?? 'pack';
    const quantity = Math.max(1, record?.quantity ?? 1);

    if (type === 'pack' && userId && planId && !alreadyCredited) {
      await this.userService.purchasePackWithQuantity(userId, planId, quantity);
    }

    // Return updated user so frontend can refresh credits without an extra GET
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

