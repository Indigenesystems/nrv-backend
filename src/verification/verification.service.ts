import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
import { PlansService } from '../plans/plans.service';
import { DojahTierService } from './dojah-tier.service';

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
    private readonly plansService: PlansService,
    private readonly dojahTierService: DojahTierService,
  ) {}

  /** Generate a random 5-digit number (10000–99999) that is not already used. */
  private async generateUniqueVerificationId(): Promise<number> {
    const min = 10000;
    const max = 99999;
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = Math.floor(Math.random() * (max - min + 1)) + min;
      const existing = await this.verificationModel.findOne({ uniqueId: candidate });
      if (!existing) return candidate;
    }
    throw new InternalServerErrorException(
      'Unable to generate unique verification ID. Please try again.',
    );
  }

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
   * Update employment info for a verification response.
   * Only sets employment-related fields so other response data is preserved.
   */
  async updateEmployment(id: string, dto: UpdateEmploymentDto): Promise<VerificationResponse | null> {
    const update: Record<string, unknown> = {};
    if (dto.employmentStatus !== undefined) update.employmentStatus = dto.employmentStatus;
    if (dto.roleInCompany !== undefined) update.roleInCompany = dto.roleInCompany;
    if (dto.companyName !== undefined) update.companyName = dto.companyName;
    if (dto.companyAddress !== undefined) update.companyAddress = dto.companyAddress;
    if (dto.monthlyIncome !== undefined) update.monthlyIncome = dto.monthlyIncome;
    if (dto.dateJoined !== undefined) update.dateJoined = dto.dateJoined;
    if (Object.keys(update).length === 0) {
      const existing = await this.verificationResponseModel.findById(id);
      if (!existing) throw new NotFoundException('Verification response not found');
      return existing;
    }
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Verification response not found');
    return updated;
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
  ): Promise<{ message: string; data: Verification; user: any }> {
    const requestedBy = typeof dto.requestedBy === 'string' ? dto.requestedBy : (dto.requestedBy as any)?.toString?.();
    if (!requestedBy) {
      throw new BadRequestException('requestedBy (landlord id) is required.');
    }
    const user = await this.userService.findUserById(requestedBy);
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    const u = user as any;
    const standardAvail = (u.standardVerificationBalance ?? 0) - (u.standardVerificationUsed ?? 0);
    const premiumAvail = (u.premiumVerificationBalance ?? 0) - (u.premiumVerificationUsed ?? 0);
    const tier = dto.verificationTier ?? 'standard';

    // Require at least 1 credit of the requested tier
    if (tier === 'standard' && standardAvail < 1) {
      throw new BadRequestException(
        'No standard verification credits left. Purchase more standard credits to request a standard verification.',
      );
    }
    if (tier === 'premium' && premiumAvail < 1) {
      throw new BadRequestException(
        'No premium verification credits left. Purchase more premium credits to request a premium verification.',
      );
    }

    try {
      const uniqueId = await this.generateUniqueVerificationId();
      const created = new this.verificationModel({ ...dto, uniqueId });
      await created.save();

      // Step 2.5: Consume the verification credit based on tier
      console.log(`[createVerificationRequest] About to consume ${tier} credit for user ${requestedBy}`);
      if (tier === 'premium') {
        await this.userService.consumePremiumVerification(requestedBy);
      } else {
        await this.userService.consumeStandardVerification(requestedBy);
      }
      console.log(`[createVerificationRequest] Credit consumed, fetching updated user...`);

      // Fetch the updated user data (with reduced credits)
      const updatedUser = await this.userService.findUserById(requestedBy);
      console.log(`[createVerificationRequest] Updated user standardVerificationUsed=${(updatedUser as any)?.standardVerificationUsed}, premiumVerificationUsed=${(updatedUser as any)?.premiumVerificationUsed}`);

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
        user: updatedUser,
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
    if (!verificationId?.trim() || !email?.trim()) {
      return null;
    }
    const vid = verificationId.trim();
    const em = email.trim();
    const doc = await this.verificationResponseModel
      .findOne({ verificationId: vid, email: new RegExp(`^${em.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .select('-__v')
      .lean()
      .exec();
    return doc ?? null;
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
  /** Dojah sandbox test NIN (used in development so NIN check does not fail). */
  private static readonly DOJAH_SANDBOX_TEST_NIN = '70123456789';

  /**
   * Normalize name for comparison: trim, lowercase, collapse spaces.
   */
  private normalizeName(name: string | null | undefined): string {
    if (name == null || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Normalize date to YYYY-MM-DD for comparison.
   */
  private normalizeDob(value: string | Date | null | undefined): string {
    if (value == null) return '';
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return '';
  }

  /**
   * Check if NIN entity name and DOB align with applicant-provided fullName and dateOfBirth.
   */
  private checkNinAlignment(
    entity: Record<string, unknown> | null | undefined,
    applicantFullName: string | null | undefined,
    applicantDob: string | Date | null | undefined,
  ): { namesMatch: boolean; dobMatch: boolean } {
    const applicantNameNorm = this.normalizeName(applicantFullName);
    const applicantDobNorm = this.normalizeDob(applicantDob);

    let namesMatch = false;
    let dobMatch = false;

    if (entity && typeof entity === 'object') {
      const first = (entity.first_name as string) ?? '';
      const middle = (entity.middle_name as string) ?? '';
      const last = (entity.last_name as string) ?? '';
      const ninFullName = [first, middle, last].filter(Boolean).join(' ');
      namesMatch = applicantNameNorm !== '' && this.normalizeName(ninFullName) === applicantNameNorm;

      const ninDob = entity.date_of_birth as string | undefined;
      dobMatch = applicantDobNorm !== '' && this.normalizeDob(ninDob) === applicantDobNorm;
    }

    return { namesMatch, dobMatch };
  }

  async verifyNinAndStoreResult(responseId: string, nin: string) {
    if (!nin || !nin.trim()) {
      throw new BadRequestException('NIN is required');
    }
    const submittedNin = nin.trim();
    const isDev = process.env.NODE_ENV !== 'production';
    const envTestNin = process.env.DOJAH_TEST_NIN?.trim();
    const validTestNin = envTestNin && /^\d{11}$/.test(envTestNin) ? envTestNin : VerificationService.DOJAH_SANDBOX_TEST_NIN;
    const ninToVerify = isDev ? validTestNin : submittedNin;

    const existingResponse = await this.verificationResponseModel.findById(responseId);
    if (!existingResponse) {
      throw new BadRequestException('Verification response not found');
    }
    const applicantFullName = existingResponse.fullName;
    const applicantDob = existingResponse.dateOfBirth;

    try {
      const verificationResult = await this.verifyNinBasic(ninToVerify);
      const entity = (verificationResult?.entity ?? verificationResult?.data?.entity) as Record<string, unknown> | undefined;
      const { namesMatch, dobMatch } = this.checkNinAlignment(entity, applicantFullName, applicantDob);

      const updateData = {
        nin: submittedNin,
        ninVerificationResult: {
          status: verificationResult?.status || 'success',
          data: verificationResult?.data ?? verificationResult,
          entity: verificationResult?.entity ?? null,
          originalNin: submittedNin,
          namesMatch,
          dobMatch,
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
      const errorMessage = this.getNinErrorMessage(error);
      const errorData = {
        nin: submittedNin,
        ninVerificationResult: {
          status: 'failed',
          error: errorMessage,
          timestamp: new Date(),
          originalError: error,
          originalNin: submittedNin,
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

  /**
   * Store credit summary result on a verification response (side-effect for Dojah call).
   */
  async storeCreditSummary(responseId: string, creditSummary: any) {
    if (!responseId) {
      return null;
    }
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      responseId,
      { creditSummary },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Verification response not found');
    }
    return updated;
  }

  /**
   * Store AML screening result on a verification response.
   */
  async storeAmlScreeningResult(responseId: string, amlScreeningResult: any) {
    if (!responseId) return null;
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      responseId,
      { amlScreeningResult },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Verification response not found');
    }
    return updated;
  }

  /** Sample PEP/AML payload for development (Dojah v2 screening). */
  private static readonly AML_DEV_PAYLOAD = {
    names: 'John Doe',
    gender: 'male',
    date_of_birth: '1990-01-01',
    nationality: '',
    id_number: 'AD45UIOO123',
    pep_check: true,
    sanction: true,
    adverse_media_check: true,
    watchlists: ['OFAC_SDN', 'EU_Terrorist'],
    match_threshold: 0.85,
    unique_reference: '123450987qwergoi',
  };

  /**
   * Run AML v2 screening for the tenant on the given response and store the result.
   * In development, uses a sample payload for consistent PEP/sanctions testing.
   */
  async runAmlScreeningAndStore(responseId: string) {
    const response = await this.verificationResponseModel.findById(responseId);
    if (!response) {
      throw new BadRequestException('Verification response not found');
    }
    const isDev = process.env.NODE_ENV === 'development';
    const params = isDev
      ? VerificationService.AML_DEV_PAYLOAD
      : {
          names: (response.fullName || '').trim(),
          date_of_birth: response.dateOfBirth
            ? new Date(response.dateOfBirth).toISOString().slice(0, 10)
            : undefined,
          gender: response.gender?.toLowerCase(),
          pep_check: true,
          sanction: true,
          adverse_media_check: true,
          match_threshold: 0.85,
        };
    if (!isDev && !params.names) {
      throw new BadRequestException('Applicant name is required for AML screening');
    }
    const result = await this.dojahTierService.amlScreeningV2Individual(params);
    await this.storeAmlScreeningResult(responseId, result);
    return result;
  }

  /**
   * Store phone fraud screening result on a verification response (side-effect for Dojah call).
   */
  async storePhoneFraudResult(responseId: string, phoneFraudResult: any) {
    if (!responseId) {
      return null;
    }
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      responseId,
      { phoneFraudResult },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Verification response not found');
    }
    return updated;
  }

  /**
   * Run Dojah document analysis on the tenant's identification document and store the result.
   * Fetches the image and sends it to Dojah as base64 (required for document analysis).
   */
  async analyzeIdentificationDocument(responseId: string) {
    const response = await this.verificationResponseModel.findById(responseId);
    if (!response) {
      throw new BadRequestException('Verification response not found');
    }
    if (!response.identificationDocumentUrl) {
      throw new BadRequestException('No identification document uploaded for this response');
    }

    try {
      // Fetch image and convert to base64 (Dojah expects base64 without data URL prefix)
      const imageResponse = await firstValueFrom(
        this.httpService.get(response.identificationDocumentUrl, {
          responseType: 'arraybuffer',
        }),
      );
      const buffer = Buffer.from(imageResponse.data);
      const base64Image = buffer.toString('base64');

      const analysis = await this.dojahTierService.documentAnalysis({
        input_type: 'base64',
        imagefrontside: base64Image,
      });

      const updated = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        {
          identificationDocumentAnalysis: {
            ...analysis,
            timestamp: new Date(),
          },
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Verification response not found');
      }
      return updated;
    } catch (error: any) {
      const updated = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        {
          identificationDocumentAnalysis: {
            status: 'failed',
            error: error?.response?.data || error?.message || 'Document analysis failed',
            timestamp: new Date(),
          },
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Verification response not found');
      }
      return updated;
    }
  }

  /**
   * Run Dojah utility bill analysis on the tenant's uploaded utility bill and store the result.
   */
  async analyzeUtilityBill(responseId: string) {
    const response = await this.verificationResponseModel.findById(responseId);
    if (!response) {
      throw new BadRequestException('Verification response not found');
    }
    if (!response.utilityBillUrl) {
      throw new BadRequestException('No utility bill uploaded for this response');
    }

    try {
      const analysis = await this.dojahTierService.utilityBillAnalysis({
        input_type: 'url',
        input_value: response.utilityBillUrl,
      });

      const updated = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        {
          utilityBillAnalysis: {
            ...analysis,
            timestamp: new Date(),
          },
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Verification response not found');
      }
      return updated;
    } catch (error: any) {
      const updated = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        {
          utilityBillAnalysis: {
            status: 'failed',
            error: error?.response?.data || error?.message || 'Utility bill analysis failed',
            timestamp: new Date(),
          },
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Verification response not found');
      }
      return updated;
    }
  }

  /**
   * Compute Tenant Trust Score (0–100), risk category, and recommendation from verification outcomes.
   * Weights: Identity 25, Contact & Address 15, Employment & Income 20, Rental Reliability 20, Guarantor 10, Compliance 10.
   */
  private computeTenantTrustScore(
    doc: VerificationResponse & { ninVerificationResult?: { namesMatch?: boolean; dobMatch?: boolean }; landlordReport?: any },
    report: { nin: string; aml: string; phone: string; idDocument: string; utilityBill: string; personalSection: string; employmentSection: string; guarantorSection: string; documentsSection: string },
  ): { riskScore: number; riskCategory: string; recommendation: string } {
    const sectionScore = (s: string) => (s === 'approved' ? 1 : s === 'pending' ? 0.5 : s === 'rejected' ? 0 : 0.25);
    const ninOk = report.nin === 'verified';
    const namesMatch = doc.ninVerificationResult?.namesMatch === true;
    const dobMatch = doc.ninVerificationResult?.dobMatch === true;
    const idOk = report.idDocument === 'verified';
    const identityScore = (ninOk ? 0.4 : 0) + (namesMatch ? 0.2 : 0) + (dobMatch ? 0.2 : 0) + (idOk ? 0.2 : 0);
    const contactScore = (report.phone === 'valid' ? 0.35 : report.phone === 'invalid' ? 0 : 0.2)
      + (report.utilityBill === 'verified' ? 0.35 : report.utilityBill === 'failed' ? 0 : 0.15)
      + (doc.email ? 0.15 : 0) + (doc.address ? 0.15 : 0);
    const employmentScore = sectionScore(report.employmentSection) * 0.5
      + (doc.monthlyIncome != null && doc.monthlyIncome > 0 ? 0.25 : 0)
      + (doc.companyName ? 0.25 : 0);
    const rentalScore = sectionScore(report.documentsSection) * 0.5 + sectionScore(report.personalSection) * 0.5;
    const guarantorScore = sectionScore(report.guarantorSection) * 0.6
      + (doc.guarantorFirstName || doc.guarantorLastName ? 0.2 : 0)
      + (doc.guarantorPhone || doc.guarantorEmail ? 0.2 : 0);
    // Compliance: AML only (no idDocument/utilityBill – those are in Identity and Contact)
    const complianceScore = report.aml === 'low_risk' ? 1 : report.aml === 'medium_risk' ? 0.6 : report.aml === 'high_risk' ? 0.2 : 0.3;
    const raw = identityScore * 25 + Math.min(1, contactScore) * 15 + employmentScore * 20 + rentalScore * 20 + guarantorScore * 10 + Math.min(1, complianceScore) * 10;
    const riskScore = Math.round(Math.max(0, Math.min(100, raw)));
    let riskCategory: string;
    let recommendation: string;
    if (riskScore >= 80) {
      riskCategory = 'Low Risk';
      recommendation = 'Approve – tenant meets verification standards.';
    } else if (riskScore >= 65) {
      riskCategory = 'Moderate Risk';
      recommendation = 'Proceed with caution – consider additional checks if needed.';
    } else if (riskScore >= 45) {
      riskCategory = 'Elevated Risk';
      recommendation = 'Request clarification or additional documentation before deciding.';
    } else {
      riskCategory = 'High Risk';
      recommendation = 'Recommend further verification or decline.';
    }
    return { riskScore, riskCategory, recommendation };
  }

  /**
   * Build a privacy-safe landlord summary report from a verification response (no PII).
   */
  private buildLandlordReport(doc: VerificationResponse & { landlordReport?: any }): NonNullable<VerificationResponse['landlordReport']> {
    const ninStatus = doc.nin
      ? (doc.ninVerificationStatus === 'completed' || doc.ninVerificationResult?.status === 'success' ? 'verified' : 'failed')
      : 'not_provided';
    const amlEntity = doc.amlScreeningResult?.entity as { risk_level?: string } | undefined;
    const amlRisk = amlEntity?.risk_level === 'low' ? 'low_risk' : amlEntity?.risk_level === 'high' ? 'high_risk' : amlEntity?.risk_level === 'medium' ? 'medium_risk' : doc.amlScreeningResult ? 'low_risk' : 'not_run';
    const amlFinal = doc.amlScreeningResult ? (amlRisk === 'low_risk' || amlRisk === 'medium_risk' || amlRisk === 'high_risk' ? amlRisk : 'low_risk') : 'not_run';
    const phoneStatus = doc.phone
      ? (doc.phoneFraudResult ? (doc.phoneFraudResult as any)?.entity?.valid === true ? 'valid' : 'invalid' : 'not_run')
      : 'not_provided';
    const creditStatus = doc.creditSummary ? 'available' : (doc.nin || (doc as any).bvn) ? 'not_available' : 'not_run';
    const idDocStatus = !doc.identificationDocumentUrl ? 'not_provided' : doc.identificationDocumentAnalysis ? (doc.identificationDocumentAnalysis as any)?.status === 'failed' ? 'failed' : 'verified' : 'not_run';
    const utilStatus = !doc.utilityBillUrl ? 'not_provided' : doc.utilityBillAnalysis ? (doc.utilityBillAnalysis as any)?.status === 'failed' ? 'failed' : 'verified' : 'not_run';
    const section = (r: { status?: string } | null | undefined) => (r?.status === 'approved' ? 'approved' : r?.status === 'rejected' ? 'rejected' : r ? 'pending' : 'not_reviewed');
    const personalSection = section(doc.personalReport);
    const employmentSection = section(doc.employmentReport);
    const guarantorSection = section(doc.guarantorReport);
    const documentsSection = section(doc.documentsReport);
    const report = {
      generatedAt: new Date(),
      nin: ninStatus,
      aml: amlFinal,
      phone: phoneStatus,
      creditSummary: creditStatus,
      idDocument: idDocStatus,
      utilityBill: utilStatus,
      personalSection,
      employmentSection,
      guarantorSection,
      documentsSection,
    };
    const { riskScore, riskCategory, recommendation } = this.computeTenantTrustScore(doc, report);
    return {
      ...report,
      riskScore,
      riskCategory,
      recommendation,
    } as NonNullable<VerificationResponse['landlordReport']>;
  }

  /**
   * Run all verification checks in one flow. Respects the verification request's tier:
   * - Standard: NIN, phone fraud, AML, ID document, utility bill (no credit score).
   * - Premium: All of the above plus credit summary (BVN).
   * Skips steps when data is missing. Sets allChecksCompletedAt and landlord report when done.
   */
  async runAllVerificationChecks(responseId: string): Promise<{
    summary: { nin: string; phoneFraud: string; creditSummary: string; aml: string; idDocument: string; utilityBill: string };
    response: VerificationResponse;
  }> {
    const response = await this.verificationResponseModel.findById(responseId);
    if (!response) {
      throw new BadRequestException('Verification response not found');
    }
    const verificationRequest = response.verificationId
      ? await this.verificationModel.findById(response.verificationId).lean()
      : null;
    const tier: 'standard' | 'premium' = (verificationRequest as any)?.verificationTier ?? 'standard';

    const summary = {
      nin: 'skipped',
      phoneFraud: 'skipped',
      creditSummary: 'skipped',
      aml: 'skipped',
      idDocument: 'skipped',
      utilityBill: 'skipped',
    } as { nin: string; phoneFraud: string; creditSummary: string; aml: string; idDocument: string; utilityBill: string };

    if (response.nin?.trim()) {
      try {
        await this.verifyNinAndStoreResult(responseId, response.nin.trim());
        summary.nin = 'ok';
      } catch {
        summary.nin = 'error';
      }
    }

    if (response.phone) {
      try {
        const result = await this.dojahTierService.phoneFraudScreen(response.phone);
        await this.storePhoneFraudResult(responseId, result);
        summary.phoneFraud = 'ok';
      } catch {
        summary.phoneFraud = 'error';
      }
    }

    const bvnOrNin = (response as any).bvn ?? response.nin;
    if (tier === 'premium' && bvnOrNin) {
      try {
        const result = await this.dojahTierService.creditSummary(bvnOrNin);
        await this.storeCreditSummary(responseId, result);
        summary.creditSummary = 'ok';
      } catch {
        summary.creditSummary = 'error';
      }
    }

    try {
      await this.runAmlScreeningAndStore(responseId);
      summary.aml = 'ok';
    } catch {
      summary.aml = 'error';
    }

    if (response.identificationDocumentUrl) {
      try {
        await this.analyzeIdentificationDocument(responseId);
        summary.idDocument = 'ok';
      } catch {
        summary.idDocument = 'error';
      }
    }

    if (response.utilityBillUrl) {
      try {
        await this.analyzeUtilityBill(responseId);
        summary.utilityBill = 'ok';
      } catch {
        summary.utilityBill = 'error';
      }
    }

    const updatedDoc = await this.verificationResponseModel.findById(responseId);
    if (!updatedDoc) return { summary, response: response as VerificationResponse };
    const landlordReport = this.buildLandlordReport(updatedDoc as VerificationResponse & { landlordReport?: any });
    await this.verificationResponseModel.findByIdAndUpdate(responseId, {
      allChecksCompletedAt: new Date(),
      landlordReport,
    });
    const updated = await this.verificationResponseModel.findById(responseId);
    return { summary, response: updated! };
  }

  /** Extract a user-friendly error string from Dojah/Nest error. */
  private getNinErrorMessage(error: any): string {
    const data = error?.response?.data;
    if (data != null) {
      if (typeof data === 'string') return data;
      if (typeof data?.error === 'string') return data.error;
      if (typeof data?.message === 'string') return data.message;
    }
    const msg = error?.message;
    if (typeof msg === 'string' && msg !== 'Bad Request Exception') return msg;
    return 'Failed to verify NIN with Dojah';
  }

  async verifyNinBasic(nin: string) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `https://sandbox.dojah.io/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}`;
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
      throw new BadRequestException(this.getNinErrorMessage(error));
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

  /**
   * AML Screening (v2) for individual – PEP, sanctions, adverse media via Dojah.
   */
  async amlScreeningIndividual(body: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    date_of_birth: string;
    match_score?: number;
    gender?: string;
    nationality?: string;
    id_number?: string;
    pep_check?: boolean;
    sanction?: boolean;
    adverse_media_check?: boolean;
    match_threshold?: number;
  }) {
    const names = [body.first_name, body.middle_name, body.last_name].filter(Boolean).join(' ');
    return this.dojahTierService.amlScreeningV2Individual({
      names,
      date_of_birth: body.date_of_birth,
      gender: body.gender,
      nationality: body.nationality,
      id_number: body.id_number,
      match_threshold: body.match_threshold ?? body.match_score ?? 0.85,
      pep_check: body.pep_check ?? true,
      sanction: body.sanction ?? true,
      adverse_media_check: body.adverse_media_check ?? true,
    });
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
