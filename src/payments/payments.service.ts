import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from './entities/payment.entity';
import { PlansService } from '../plans/plans.service';
import { PaystackService } from './paystack.service';
import { UserService } from '../users/users.service';

/** Abandoned Paystack checkouts are resumable for this long, then marked failed. */
export const PAYMENT_PENDING_TTL_MS = 30 * 60 * 1000;

const TERMINAL_PAYSTACK_FAILURE = new Set(['failed', 'reversed']);

const RESUMABLE_PAYSTACK_STATUS = new Set([
  'pending',
  'abandoned',
  'ongoing',
  'processing',
  'queued',
]);

const isResumablePaystackStatus = (status?: string): boolean => {
  if (!status) {
    return true;
  }
  return RESUMABLE_PAYSTACK_STATUS.has(status);
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly plansService: PlansService,
    private readonly paystackService: PaystackService,
    private readonly userService: UserService,
  ) {}

  /**
   * Record a new payment (pending) when initializing with Paystack.
   */
  async createPayment(data: {
    userId: string;
    planId: string;
    type: string;
    reference: string;
    amountNaira: number;
    amountKobo?: number;
    currency?: string;
    quantity?: number;
    authorizationUrl?: string;
  }): Promise<PaymentDocument> {
    let planName: string | undefined;
    try {
      const plan = await this.plansService.findById(data.planId) as any;
      planName = plan?.name;
    } catch {
      planName = undefined;
    }
    const doc = await this.paymentModel.create({
      userId: data.userId,
      planId: data.planId,
      type: data.type,
      reference: data.reference,
      amountNaira: data.amountNaira,
      amountKobo: data.amountKobo ?? Math.round(data.amountNaira * 100),
      currency: data.currency ?? 'NGN',
      status: 'pending',
      planName,
      quantity: data.quantity ?? 1,
      authorizationUrl: data.authorizationUrl,
    });
    return doc;
  }

  /**
   * Find payment by Paystack reference.
   */
  async findByReference(reference: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ reference }).exec();
  }

  /**
   * Update payment status after verification (success or failed).
   */
  async updatePaymentStatus(
    reference: string,
    status: PaymentStatus,
    paidAt?: Date,
  ): Promise<PaymentDocument> {
    const update: any = { status };
    if (status === 'success' && paidAt) {
      update.paidAt = paidAt;
    }
    const updated = await this.paymentModel
      .findOneAndUpdate({ reference }, update, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Payment not found: ${reference}`);
    }
    return updated;
  }

  private getCallbackUrl(): string {
    return (
      process.env.PAYSTACK_CALLBACK_URL ||
      'https://www.naijarentverify.com/payments/callback'
    );
  }

  private isPendingExpired(createdAt?: Date | string): boolean {
    if (!createdAt) {
      return true;
    }
    return Date.now() - new Date(createdAt).getTime() > PAYMENT_PENDING_TTL_MS;
  }

  /**
   * Award credits when Paystack confirms success (idempotent).
   */
  async fulfillSuccessfulPayment(payment: PaymentDocument): Promise<void> {
    if (payment.status === 'success') {
      return;
    }

    await this.updatePaymentStatus(payment.reference, 'success', new Date());

    const userId = payment.userId?.toString?.() ?? String(payment.userId);
    const planId = payment.planId?.toString?.() ?? String(payment.planId);
    const quantity = Math.max(1, payment.quantity ?? 1);

    if (payment.type === 'pack' && userId && planId) {
      await this.userService.purchasePackWithQuantity(userId, planId, quantity);
    }
  }

  /**
   * Create a fresh Paystack checkout for an existing pending payment (e.g. missing URL).
   */
  async refreshPendingCheckoutUrl(payment: PaymentDocument): Promise<string> {
    const user = await this.userService.findUserById(
      payment.userId?.toString?.() ?? String(payment.userId),
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reference = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data = await this.paystackService.initializeTransaction({
      email: (user as any).email,
      amountNaira: payment.amountNaira,
      reference,
      callbackUrl: this.getCallbackUrl(),
      metadata: {
        userId: payment.userId?.toString?.() ?? payment.userId,
        planId: payment.planId?.toString?.() ?? payment.planId,
        type: payment.type,
      },
    });

    await this.paymentModel
      .updateOne(
        { _id: payment._id },
        {
          reference,
          authorizationUrl: data.authorization_url,
          status: 'pending',
        },
      )
      .exec();

    return data.authorization_url;
  }

  /**
   * Expire stale pending payments and sync open ones with Paystack.
   * Abandoned checkouts stay pending until the TTL so users can resume later.
   */
  async reconcilePendingPayments(userId: string): Promise<void> {
    const pending = await this.paymentModel
      .find({ userId, status: 'pending' })
      .exec();

    for (const payment of pending) {
      const createdAt = (payment as any).createdAt as Date | string | undefined;
      if (this.isPendingExpired(createdAt)) {
        await this.updatePaymentStatus(payment.reference, 'failed');
        continue;
      }

      try {
        const result = await this.paystackService.verifyTransaction(payment.reference);
        const psStatus = result?.data?.status as string | undefined;

        if (psStatus === 'success') {
          await this.fulfillSuccessfulPayment(payment);
          continue;
        }

        if (psStatus && TERMINAL_PAYSTACK_FAILURE.has(psStatus)) {
          await this.updatePaymentStatus(payment.reference, 'failed');
        }
      } catch {
        // Keep pending until TTL if Paystack is unreachable
      }
    }
  }

  /**
   * Resume an abandoned checkout: return stored Paystack URL or signal re-checkout.
   */
  async resumePayment(
    reference: string,
    userId: string,
  ): Promise<
    | { kind: 'redirect'; authorization_url: string; reference: string }
    | { kind: 'verify'; reference: string }
    | { kind: 'already_paid'; reference: string }
    | { kind: 'expired' }
  > {
    const payment = await this.paymentModel.findOne({ reference }).exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (String(payment.userId) !== String(userId)) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'success') {
      return { kind: 'already_paid', reference };
    }
    if (payment.status === 'failed') {
      return { kind: 'expired' };
    }

    const createdAt = (payment as any).createdAt as Date | string | undefined;
    if (this.isPendingExpired(createdAt)) {
      await this.updatePaymentStatus(reference, 'failed');
      return { kind: 'expired' };
    }

    try {
      const result = await this.paystackService.verifyTransaction(reference);
      const psStatus = result?.data?.status as string | undefined;
      if (psStatus === 'success') {
        return { kind: 'verify', reference };
      }
      if (psStatus && TERMINAL_PAYSTACK_FAILURE.has(psStatus)) {
        await this.updatePaymentStatus(reference, 'failed');
        return { kind: 'expired' };
      }
    } catch {
      // Fall through to stored authorization URL
    }

    let authorizationUrl = payment.authorizationUrl;
    if (!authorizationUrl) {
      try {
        authorizationUrl = await this.refreshPendingCheckoutUrl(payment);
      } catch {
        await this.updatePaymentStatus(reference, 'failed');
        return { kind: 'expired' };
      }
    }

    const latest = await this.paymentModel.findOne({ _id: payment._id }).exec();
    const activeReference = latest?.reference ?? reference;

    return {
      kind: 'redirect',
      authorization_url: authorizationUrl,
      reference: activeReference,
    };
  }

  /**
   * List payment/purchase history for a user (paginated, newest first).
   */
  async findByUserPaginated(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<{
    data: PaymentDocument[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    await this.reconcilePendingPayments(userId);

    const page = Math.max(1, params.page);
    const limit = Math.min(50, Math.max(1, params.limit));
    const skip = (page - 1) * limit;
    const filter = { userId };

    const [total, data] = await Promise.all([
      this.paymentModel.countDocuments(filter).exec(),
      this.paymentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return {
      data: data as PaymentDocument[],
      pagination: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /**
   * Most recent resumable pending payment for a user (if any).
   */
  async findLatestPendingPayment(userId: string): Promise<PaymentDocument | null> {
    await this.reconcilePendingPayments(userId);
    const pending = await this.paymentModel
      .find({ userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean()
      .exec();
    return (pending[0] as PaymentDocument) ?? null;
  }

  isPaystackStatusResumable(status?: string): boolean {
    return isResumablePaystackStatus(status);
  }
}
