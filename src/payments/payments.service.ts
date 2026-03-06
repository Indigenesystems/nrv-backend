import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from './entities/payment.entity';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly plansService: PlansService,
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
    if (status === 'success' && paidAt) update.paidAt = paidAt;
    const updated = await this.paymentModel
      .findOneAndUpdate({ reference }, update, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Payment not found: ${reference}`);
    return updated;
  }

  /**
   * List payment/purchase history for a user (newest first).
   */
  async findByUser(userId: string): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<PaymentDocument[]>;
  }
}
