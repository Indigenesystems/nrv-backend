import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateTenantVerificationDto, CreateVerificationDto, UpdateEmploymentDto, UpdateGuarantorDto } from './dto/create-verification.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import {
  Verification,
  VerificationDocument,
} from './entities/verification.entity';
import { EmailService } from '../email-sender/email.service';
import { VerificationResponse } from './entities/verification-response.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { VerificationHistory, VerificationHistoryDocument } from './entities/verification-history.entity';
import { UserService } from '../users/users.service';

@Injectable()
export class VerificationService {
  constructor(
    @InjectModel(Verification.name)
    private readonly verificationModel: Model<VerificationDocument>,
    @InjectModel(VerificationResponse.name)
    private readonly verificationResponseModel: Model<VerificationResponse>,
    @InjectModel(VerificationHistory.name)
    private readonly verificationHistoryModel: Model<VerificationHistoryDocument>,
    private readonly cloudinary: CloudinaryService,
    private emailService: EmailService,
    private readonly httpService: HttpService,
    private readonly userService: UserService,
  ) {}

  /**
   * Create a new tenant verification response
   * @param dto
   * @returns Created verification response
   */
  async create(dto: CreateTenantVerificationDto): Promise<VerificationResponse> {
    const request = await this.verificationModel.findById(dto.verificationId);
    if (!request) {
      throw new BadRequestException('Verification request not found. Invalid verificationId.');
    }
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

      // Step 3: If tenant doesn't have an account yet, create one and send them their password
      const existingUser = await this.userService.findUserByEmail(dto.email);
      if (!existingUser) {
        try {
          const newTenant = {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phoneNumber: dto.phone || '',
            nin: '',
            homeAddress: '',
            confirmationCode: '',
            status: 'active',
            isOnboarded: false,
            accountType: 'tenant',
          };
          await this.userService.createUserByLandlord(newTenant);
          console.log(`Created tenant account for ${dto.email} (invited by landlord)`);
        } catch (createErr: any) {
          console.error('Failed to create tenant account on invite:', createErr?.message || createErr);
          // Don't fail the verification request - verification is already saved
        }
      }

      // Step 4: Generate verification link with request id so tenant lands on the right form
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const verificationLink = `${frontendUrl}/dashboard/tenant/verification?verificationId=${created._id}`;
      // Step 5: Send verification invite email (non-blocking - verification succeeds even if email fails)
      try {
        await this.emailService.sendTenantVerificationInviteEmail({
          recipientName: created.firstName || created.email,
          recipientEmail: created.email,
          landlordName: created.landlordDisplayName,
          formLink: verificationLink,
        });
      } catch (emailErr) {
        console.error('Verification invite email failed (verification was saved):', emailErr?.message || emailErr);
        // Don't fail the request - verification is already saved
      }
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
   * Update a verification request (e.g. set status to approved/rejected)
   * @param id
   * @param dto
   * @returns Updated verification or throws if not found
   */
  async updateVerification(id: string, dto: UpdateVerificationDto): Promise<Verification> {
    const updated = await this.verificationModel.findByIdAndUpdate(
      id,
      { ...dto, dateUpdated: new Date() },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Verification not found.');
    }
    return updated;
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

  async verifyBvnWithDojah(bvn: string) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `https://sandbox.dojah.io/api/v1/kyc/bvn/advance?bvn=${bvn}`;
    try {
      const response$ = this.httpService.get(url, {
        headers: {
          'AppId': appId,
          'Authorization': authKey,
        },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new BadRequestException(error?.response?.data || 'Failed to verify BVN with Dojah');
    }
  }

  async verifyPhoneNumberBasic(phone: string) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `https://sandbox.dojah.io/api/v1/kyc/phone_number/basic?phone_number=${phone}`;
    try {
      const response$ = this.httpService.get(url, {
        headers: {
          'AppId': appId,
          'Authorization': authKey,
        },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new BadRequestException(error?.response?.data || 'Failed to verify phone number with Dojah');
    }
  }

  /**
   * Verify phone number and store the result in verification response
   * @param responseId
   * @param phone
   * @returns Updated verification response with phone verification result
   */
  async verifyPhoneAndStoreResult(responseId: string, phone: string) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const phoneToVerify = isDevelopment ? '09011111111' : (phone || '09011111111');
    try {
      const verificationResult = await this.verifyPhoneNumberBasic(phoneToVerify);
      
      // Update the verification response with the complete phone verification result
      const updateData = {
        phoneVerificationResult: {
          status: verificationResult.status || 'success',
          data: verificationResult.data || verificationResult,
          entity: verificationResult.entity || null,
          originalPhone: phone,
          finalPhone: phoneToVerify, // in development always 09011111111 (Dojah test number)
          ...verificationResult
        },
        phoneVerificationDate: new Date(),
        phoneVerificationStatus: verificationResult.status || 'completed'
      };
      
      const updatedResponse = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        updateData,
        { new: true }
      );
      
      if (!updatedResponse) {
        throw new BadRequestException('Verification response not found');
      }
      
      return updatedResponse;
    } catch (error) {
      // If verification fails, still store the error result
      const errorData = {
        phoneVerificationResult: {
          status: 'failed',
          error: error?.response?.data || error?.message || 'Phone verification failed',
          timestamp: new Date(),
          originalError: error,
          originalPhone: phone,
          finalPhone: phoneToVerify
        },
        phoneVerificationDate: new Date(),
        phoneVerificationStatus: 'failed'
      };
      
      const updatedResponse = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        errorData,
        { new: true }
      );
      
      if (!updatedResponse) {
        throw new BadRequestException('Verification response not found');
      }
      
      return updatedResponse;
    }
  }

  /**
   * Verify NIN and store the result in verification response
   * @param responseId
   * @param nin
   * @returns Updated verification response with NIN verification result
   */
  async verifyNinAndStoreResult(responseId: string, nin: string) {
    if (!nin || !nin.trim()) {
      throw new BadRequestException('NIN is required');
    }
    try {
      const verificationResult = await this.verifyNinBasic(nin.trim());
      const updateData = {
        nin: nin.trim(),
        ninVerificationResult: {
          status: verificationResult?.status || 'success',
          data: verificationResult?.data ?? verificationResult,
          entity: verificationResult?.entity ?? null,
          originalNin: nin.trim(),
          ...verificationResult,
        },
        ninVerificationDate: new Date(),
        ninVerificationStatus: verificationResult?.status || 'completed',
      };
      const updatedResponse = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        updateData,
        { new: true },
      );
      if (!updatedResponse) {
        throw new BadRequestException('Verification response not found');
      }
      return updatedResponse;
    } catch (error) {
      const errorData = {
        nin: nin.trim(),
        ninVerificationResult: {
          status: 'failed',
          error: error?.response?.data || error?.message || 'NIN verification failed',
          timestamp: new Date(),
          originalError: error,
          originalNin: nin.trim(),
        },
        ninVerificationDate: new Date(),
        ninVerificationStatus: 'failed',
      };
      const updatedResponse = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        errorData,
        { new: true },
      );
      if (!updatedResponse) {
        throw new BadRequestException('Verification response not found');
      }
      return updatedResponse;
    }
  }

  async verifyNinBasic(nin: string) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `https://sandbox.dojah.io/api/v1/kyc/nin?nin=${nin}`;
    try {
      const response$ = this.httpService.get(url, {
        headers: {
          'AppId': appId,
          'Authorization': authKey,
        },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new BadRequestException(error?.response?.data || 'Failed to verify NIN with Dojah');
    }
  }

  async verifyDriversLicence(dl: string) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `https://sandbox.dojah.io/api/v1/kyc/dl?dl=${dl}`;
    try {
      const response$ = this.httpService.get(url, {
        headers: {
          'AppId': appId,
          'Authorization': authKey,
        },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new BadRequestException(error?.response?.data || 'Failed to verify Driver\'s Licence with Dojah');
    }
  }

  async verifyVotersId(vin: string) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `https://sandbox.dojah.io/api/v1/kyc/vin?vin=${vin}`;
    try {
      const response$ = this.httpService.get(url, {
        headers: {
          'AppId': appId,
          'Authorization': authKey,
        },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new BadRequestException(error?.response?.data || 'Failed to verify Voter\'s ID with Dojah');
    }
  }

  async amlScreeningIndividual(body: {
    first_name: string;
    middle_name: string;
    last_name: string;
    date_of_birth: string;
    match_score: number;
  }) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `https://sandbox.dojah.io/api/v1/aml/screening`;
    try {
      const response$ = this.httpService.post(url, body, {
        headers: {
          'AppId': appId,
          'Authorization': authKey,
        },
      });
      const response = await firstValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new BadRequestException(error?.response?.data || 'Failed to perform AML screening with Dojah');
    }
  }

  async getAllVerificationsWithQuery(
    searchParams?: {
      search?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: string;
      limit?: string;
    }
  ): Promise<{ data: Verification[]; pagination: { total: number; page: number; limit: number; totalPages: number; totalResults: number } }> {
    let query: any = {};

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
    const verifications = await this.verificationModel
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return {
      data: verifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
      },
    };
  }

  async createVerificationHistory(data: {
    userId: string;
    type: string;
    input: Record<string, any>;
    result: Record<string, any>;
    adminId: string;
    adminName: string;
  }): Promise<VerificationHistory> {
    return this.verificationHistoryModel.create(data);
  }

  async getVerificationHistory(userId?: string): Promise<VerificationHistory[]> {
    const query = userId ? { userId } : {};
    return this.verificationHistoryModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get all verification responses by verificationId
   * @param verificationId
   * @returns Array of VerificationResponse
   */
  async getVerificationResponsesByVerificationId(verificationId: string): Promise<VerificationResponse[]> {
    return this.verificationResponseModel.find({ verificationId });
  }

  /**
   * Update personal report for a verification response
   */
  async updatePersonalReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    return this.verificationResponseModel.findByIdAndUpdate(id, { personalReport: report }, { new: true });
  }

  /**
   * Update employment report for a verification response
   */
  async updateEmploymentReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    return this.verificationResponseModel.findByIdAndUpdate(id, { employmentReport: report }, { new: true });
  }

  /**
   * Update guarantor report for a verification response
   */
  async updateGuarantorReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    return this.verificationResponseModel.findByIdAndUpdate(id, { guarantorReport: report }, { new: true });
  }

  /**
   * Update documents report for a verification response
   */
  async updateDocumentsReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    return this.verificationResponseModel.findByIdAndUpdate(id, { documentsReport: report }, { new: true });
  }
}
