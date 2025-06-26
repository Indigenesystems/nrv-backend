import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { Verification, VerificationDocument } from './entities/verification.entity';


@Injectable()
export class VerificationService {
  constructor(
    @InjectModel(Verification.name)
    private readonly verificationModel: Model<VerificationDocument>,
  ) {}

  async createVerificationRequest(
    dto: CreateVerificationDto,
  ): Promise<{ message: string; data: Verification }> {
    const existing = await this.verificationModel.findOne({
      $or: [{ email: dto.email }, { phone: dto.phone }],
    });

    if (existing) {
      throw new BadRequestException('Tenant verification already exists.');
    }

    try {
      const created = new this.verificationModel(dto);
      await created.save();
      return {
        message: 'Tenant verification request submitted successfully.',
        data: created,
      };
    } catch (err) {
      console.error('Verification save failed:', err);
      throw new InternalServerErrorException('Could not create verification.');
    }
  }

  async getAllVerifications(): Promise<Verification[]> {
    return this.verificationModel.find().sort({ createdAt: -1 });
  }

  async getVerificationById(id: string): Promise<Verification> {
    const verification = await this.verificationModel.findById(id);
    if (!verification) {
      throw new BadRequestException('Verification not found.');
    }
    return verification;
  }

  async getVerificationByUserId(id: string): Promise<Verification[]> {
    const verification = await this.verificationModel.find({requestedBy: id});
    if (!verification) {
      throw new BadRequestException('Verification not found.');
    }
    return verification;
  }
}
