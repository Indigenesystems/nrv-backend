import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateTenantVerificationDto, CreateVerificationDto, UpdateEmploymentDto, UpdateGuarantorDto } from './dto/create-verification.dto';
import {
  Verification,
  VerificationDocument,
} from './entities/verification.entity';
import { EmailService } from '../email-sender/email.service';
import { VerificationResponse } from './entities/verification-response.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';

@Injectable()
export class VerificationService {
  constructor(
    @InjectModel(Verification.name)
    private readonly verificationModel: Model<VerificationDocument>,
    @InjectModel(VerificationResponse.name)
    private readonly verificationResponseModel: Model<VerificationResponse>,
    private readonly cloudinary: CloudinaryService,
    private emailService: EmailService,
  ) {}

  /**
   * Create a new tenant verification response
   * @param dto
   * @returns Created verification response
   */
  async create(dto: CreateTenantVerificationDto): Promise<VerificationResponse> {
    return this.verificationResponseModel.create(dto);
  }

  /**
   * Update employment info for a verification response
   * @param id
   * @param dto
   * @returns Updated verification response or null
   */
  async updateEmployment(id: string, dto: UpdateEmploymentDto): Promise<VerificationResponse | null> {
    console.log({ id, dto });
    return this.verificationResponseModel.findByIdAndUpdate(id, dto, { new: true });
  }

  /**
   * Update guarantor info for a verification response
   * @param id
   * @param dto
   * @returns Updated verification response or null
   */
  async updateGuarantor(id: string, dto: UpdateGuarantorDto): Promise<VerificationResponse | null> {
    console.log({ id, dto });
    return this.verificationResponseModel.findByIdAndUpdate(id, dto, { new: true });
  }

  /**
   * Upload affordability documents and update verification response
   * @param id
   * @param files
   * @returns Updated verification response or null
   */
  async uploadAffordability(id: string, files: any, body?: any): Promise<VerificationResponse | null> {
    const updatePayload: Partial<VerificationResponse> = {};
    // Helper for uploading a file and returning its URL
    const uploadFile = async (file: Express.Multer.File | undefined) => {
      if (!file) return undefined;
      const upload = await this.cloudinary.upload(file);
      console.log({ upload });
      
      return upload;
    };
    if (files.bankStatement?.[0]) {
      updatePayload.bankStatementUrl = await uploadFile(files.bankStatement[0]);
    }
    if (files.utilityBill?.[0]) {
      updatePayload.utilityBillUrl = await uploadFile(files.utilityBill[0]);
    }
    if (files.identificationDocument?.[0]) {
      updatePayload.identificationDocumentUrl = await uploadFile(files.identificationDocument[0]);
      if (body?.identificationDocumentType) {
        updatePayload.identificationDocumentType = body.identificationDocumentType;
      }
    }

    console.log({ updatePayload });
    
    return this.verificationResponseModel.findByIdAndUpdate(id, updatePayload, { new: true });
  }

  /**
   * Get a verification response by its ID
   * @param id
   * @returns Verification response or null
   */
  async getById(id: string): Promise<VerificationResponse | null> {
    return this.verificationResponseModel.findById(id);
  }

  /**
   * Create a new verification request and send email
   * @param dto
   * @returns Success message and created verification
   */
  async createVerificationRequest(
    dto: CreateVerificationDto,
  ): Promise<{ message: string; data: Verification }> {
    // Step 1: Check if verification already exists (commented out for now)
    // const existing = await this.verificationModel.findOne({
    //   $or: [{ email: dto.email }, { phone: dto.phone }],
    // });
    // if (existing) {
    //   throw new BadRequestException('Tenant verification already exists.');
    // }
    try {
      // Step 2: Create and save new verification entry
      const created = new this.verificationModel(dto);
      await created.save();
      // Step 3: Generate verification link (customize with token if needed)
      const verificationLink = `http://localhost:3000/dashboard/tenant/verification`;
      // Step 4: Send verification email
      await this.emailService.sendTenantVerificationInviteEmail({
        recipientName: created.firstName || created.email,
        recipientEmail: created.email,
        landlordName: created.landlordDisplayName,
        formLink: verificationLink,
      });
      return {
        message: 'Tenant verification request submitted successfully.',
        data: created,
      };
    } catch (err) {
      console.error('Verification save failed:', err);
      throw new InternalServerErrorException('Could not create verification.');
    }
  }

  /**
   * Get all verifications (sorted by creation date)
   * @returns Array of verifications
   */
  async getAllVerifications(): Promise<Verification[]> {
    return this.verificationModel.find().sort({ createdAt: -1 });
  }

  /**
   * Get a verification by its ID
   * @param id
   * @returns Verification or throws if not found
   */
  async getVerificationById(id: string): Promise<Verification> {
    const verification = await this.verificationModel.findById(id);
    if (!verification) {
      throw new BadRequestException('Verification not found.');
    }
    return verification;
  }

  /**
   * Get all verifications requested by a user with search and sorting
   * @param id
   * @param searchParams
   * @returns Array of verifications or throws if not found
   */
  async getVerificationByUserId(
    id: string, 
    searchParams?: { 
      search?: string; 
      status?: string; 
      sortBy?: string; 
      sortOrder?: 'asc' | 'desc';
      page?: string;
      limit?: string;
    }
  ): Promise<{ data: Verification[]; pagination: { total: number; page: number; limit: number } }> {
    let query: any = { requestedBy: id };
    
    // Add search functionality
    if (searchParams?.search) {
      const searchRegex = new RegExp(searchParams.search, 'i');
      query = {
        ...query,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { streetAddress: searchRegex },
        ],
      };
    }
    
    // Add status filter
    if (searchParams?.status && searchParams.status !== '') {
      query = { ...query, status: searchParams.status };
    }
    
    // Build sort object
    let sort: any = { createdAt: -1 }; // Default: most recent first
    if (searchParams?.sortBy) {
      sort = { [searchParams.sortBy]: searchParams.sortOrder === 'asc' ? 1 : -1 };
    }
    
    // Pagination
    const page = parseInt(searchParams?.page || '1');
    const limit = parseInt(searchParams?.limit || '10');
    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await this.verificationModel.countDocuments(query);
    
    // Get paginated results
    const verification = await this.verificationModel
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    if (!verification) {
      throw new BadRequestException('Verification not found.');
    }
    
    return {
      data: verification,
      pagination: {
        total,
        page,
        limit,
      },
    };
  }

  /**
   * Get a verification response by its ID
   * @param id
   * @returns Verification response or null
   */
  async getVerificationResponseById(id: string): Promise<VerificationResponse | null> {
    return this.verificationResponseModel.findOne({ _id: id });
  }

  /**
   * Get the latest verification response for a user
   * @param userId
   * @returns Latest VerificationResponse or null
   */
  async getLatestVerificationResponseByUser(userId: string): Promise<VerificationResponse | null> {
    // If VerificationResponse has a userId/requestedBy field, use it. Otherwise, join by email.
    // Here, we assume the VerificationResponse has a requestedBy or userId field.
    return this.verificationResponseModel
      .findOne({ requestedBy: userId })
      .sort({ createdAt: -1 });
  }

  /**
   * Get all verifications by email
   * @param email
   * @returns Array of verifications
   */
  async getVerificationsByEmail(email: string): Promise<Verification[]> {
    return this.verificationModel.find({ email }).populate('requestedBy');
  }

  /**
   * Get a verification response by verification request ID and tenant email
   * @param verificationId
   * @param email
   * @returns VerificationResponse or null
   */
  async getVerificationResponseByRequestAndEmail(verificationId: string, email: string) {
    console.log({ verificationId, email });
    
    return this.verificationResponseModel.findOne({ verificationId: verificationId, email: email });
  }

  /**
   * Get available verification statuses
   * @returns Array of status options
   */
  async getVerificationStatuses() {
    return [
      { value: '', label: 'All Status' },
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
    ];
  }
}
