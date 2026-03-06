import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from './entities/plan.entity';

export const PLAN_SLUG_STANDARD = 'standard';
export const PLAN_SLUG_PREMIUM = 'premium';

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
    await this.backfillVerificationLimit();
    await this.backfillPackFields();
  }

  /** Ensure verificationLimit is 5 (standard) and 20 (premium). */
  private async backfillVerificationLimit() {
    await this.planModel.updateMany(
      { slug: PLAN_SLUG_PREMIUM },
      { $set: { verificationLimit: 20 } },
    ).exec();
    await this.planModel.updateMany(
      { slug: PLAN_SLUG_STANDARD },
      { $set: { verificationLimit: 5 } },
    ).exec();
  }

  /** Pack = verification credits only. Standard = 5 standard; Premium = 5 premium. */
  private async backfillPackFields() {
    await this.planModel.updateMany(
      { slug: PLAN_SLUG_STANDARD },
      { $set: { standardVerificationAdded: 5, premiumVerificationAdded: 0 } },
    ).exec();
    await this.planModel.updateMany(
      { slug: PLAN_SLUG_PREMIUM },
      { $set: { standardVerificationAdded: 0, premiumVerificationAdded: 5 } },
    ).exec();
  }

  private async seedDefaultPlans() {
    const standard = await this.planModel.findOne({ slug: PLAN_SLUG_STANDARD });
    if (!standard) {
      await this.planModel.create({
        slug: PLAN_SLUG_STANDARD,
        name: 'Standard Verification',
        description: 'Recommended for platform launch. NIN Advanced, Selfie + NIN, Liveness, AML, Fraud & PEP/sanctions screening.',
        verificationTier: 'standard',
        verificationLimit: 5,
        standardVerificationAdded: 5,
        premiumVerificationAdded: 0,
        isActive: true,
        features: [
          'NIN Lookup Advanced',
          'Selfie + NIN',
          'Liveness Check',
          'AML Screening',
          'Fraud risk screening',
          'Politically exposed persons & sanctions list',
        ],
      });
    }

    const premium = await this.planModel.findOne({ slug: PLAN_SLUG_PREMIUM });
    if (!premium) {
      await this.planModel.create({
        slug: PLAN_SLUG_PREMIUM,
        name: 'Premium Tenant Screening',
        description: 'High-trust tier. All Standard features plus Credit Score.',
        verificationTier: 'premium',
        verificationLimit: 20,
        standardVerificationAdded: 0,
        premiumVerificationAdded: 5,
        isActive: true,
        features: [
          'NIN Advanced',
          'Selfie + NIN',
          'Liveness',
          'AML Screening',
          'Credit Score',
          'Fraud risk screening',
          'PEP & sanctions list',
        ],
      });
    }
  }

  async findBySlug(slug: string): Promise<Plan | null> {
    return this.planModel.findOne({ slug, isActive: true }).lean().exec();
  }

  async findById(id: string): Promise<Plan> {
    const plan = await this.planModel.findById(id).lean().exec();
    if (!plan) throw new NotFoundException('Plan not found');
    return plan as Plan;
  }

  async getDefaultPlan(): Promise<Plan> {
    const plan = await this.findBySlug(PLAN_SLUG_PREMIUM);
    if (!plan) throw new NotFoundException('Default plan (premium) not found');
    return plan;
  }

  async getAll(): Promise<Plan[]> {
    return this.planModel.find({ isActive: true }).lean().exec() as Promise<Plan[]>;
  }
}
