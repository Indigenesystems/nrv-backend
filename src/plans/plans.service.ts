import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from './entities/plan.entity';

export const PLAN_SLUG_STANDARD = 'standard';
export const PLAN_SLUG_PREMIUM = 'premium';

/** Per verification credit (Naira). */
export const UNIT_PRICE_NAIRA = {
  standard: 15_000,
  premium: 25_000,
} as const;

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
    await this.backfillVerificationLimit();
    await this.backfillPackFields();
    await this.backfillFriendlyCopy();
  }

  /** Legacy display cap (not used for per-credit purchase math). */
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

  /** Per-credit purchase: each unit adds 1 credit; price is quantity × unitPriceNaira. */
  private async backfillPackFields() {
    await this.planModel.updateMany(
      { slug: PLAN_SLUG_STANDARD },
      {
        $set: {
          standardVerificationAdded: 1,
          premiumVerificationAdded: 0,
          unitPriceNaira: UNIT_PRICE_NAIRA.standard,
        },
      },
    ).exec();
    await this.planModel.updateMany(
      { slug: PLAN_SLUG_PREMIUM },
      {
        $set: {
          standardVerificationAdded: 0,
          premiumVerificationAdded: 1,
          unitPriceNaira: UNIT_PRICE_NAIRA.premium,
        },
      },
    ).exec();
  }

  /** Plain-language copy: one description per tier; Premium = Standard + affordability. */
  private async backfillFriendlyCopy() {
    await this.planModel
      .updateMany(
        { slug: PLAN_SLUG_STANDARD },
        {
          $set: {
            name: 'Standard Verification',
            description:
              'We help you check who a tenant really is before you sign: identity, whether their details line up, and the usual background pieces landlords care about—rolled into one clear report you can actually read, without compliance jargon. Each credit covers one tenant.',
            features: [],
          },
        },
      )
      .exec();

    await this.planModel
      .updateMany(
        { slug: PLAN_SLUG_PREMIUM },
        {
          $set: {
            name: 'Premium Tenant Screening',
            description:
              'Everything Standard includes—same identity and background picture in plain English—plus affordability checks so you can see whether the rent is realistic for them. Each credit covers one tenant.',
            features: [],
          },
        },
      )
      .exec();
  }

  private async seedDefaultPlans() {
    const standard = await this.planModel.findOne({ slug: PLAN_SLUG_STANDARD });
    if (!standard) {
      await this.planModel.create({
        slug: PLAN_SLUG_STANDARD,
        name: 'Standard Verification',
        description:
          'We help you check who a tenant really is before you sign: identity, whether their details line up, and the usual background pieces landlords care about—rolled into one clear report you can actually read, without compliance jargon. Each credit covers one tenant.',
        verificationTier: 'standard',
        verificationLimit: 5,
        standardVerificationAdded: 1,
        premiumVerificationAdded: 0,
        unitPriceNaira: UNIT_PRICE_NAIRA.standard,
        isActive: true,
        features: [],
      });
    }

    const premium = await this.planModel.findOne({ slug: PLAN_SLUG_PREMIUM });
    if (!premium) {
      await this.planModel.create({
        slug: PLAN_SLUG_PREMIUM,
        name: 'Premium Tenant Screening',
        description:
          'Everything Standard includes—same identity and background picture in plain English—plus affordability checks so you can see whether the rent is realistic for them. Each credit covers one tenant.',
        verificationTier: 'premium',
        verificationLimit: 20,
        standardVerificationAdded: 0,
        premiumVerificationAdded: 1,
        unitPriceNaira: UNIT_PRICE_NAIRA.premium,
        isActive: true,
        features: [],
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
