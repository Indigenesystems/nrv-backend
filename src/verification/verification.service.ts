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
import {
  identificationDocumentAnalysisOutcome,
  logDojahDbUpdate,
  logDojahRequest,
  logDojahResponse,
  maskDigits,
  summarizeError,
  summarizeForLog,
  utilityBillAnalysisOutcome,
} from './dojah-logging';
import {
  formatPhoneForDojah,
  getDojahApiBase,
  getDojahTestNin,
  getDojahTestPhone,
  useDojahTestIdentifiers,
} from './dojah-env.util';
import {
  buildAmlInputKey,
  canReuseDojahCheck,
  DojahCheckCacheEntry,
} from './dojah-check-cache.util';
import {
  resolveUtilityBillLandlordStatus,
  toDojahUtilityBillImageUrl,
} from './utility-bill.util';
import {
  alignBreakdownEarnedToTotal,
  buildRedactedVerificationCheckSummaries,
  buildTenantRiskBreakdown,
  sumRiskBreakdownEarned,
  DocForRisk,
  LandlordReportForRisk,
} from './verification-risk-display.util';
import {
  checkNinNameAlignment,
  getNinAlignmentForDoc,
  resolveDojahNinEntity,
} from './nin-name-match.util';
import {
  CreditFinancialSnapshot,
  parseCreditFinancialSnapshot,
  resolveLandlordCreditOutcome,
} from './credit-financial.util';
import {
  getIdDocumentNinAlignment,
  resolveIdDocumentLandlordStatus,
} from './id-document.util';
import {
  buildDocForRiskFromResponse,
  coerceMonthlyIncome,
} from './verification-doc-for-risk.util';
import {
  VERIFICATION_CHECK_KEYS,
  VerificationCheckKey,
  VerificationCheckRunStatus,
  VerificationChecksSummary,
} from './verification-check-keys';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Same host selection as `DojahTierService` (sandbox vs production). */
  private dojahApiBase(): string {
    return getDojahApiBase();
  }

  /** Log + time direct Dojah HTTP from this service (NIN/BVN/phone basic, etc.). */
  private async traceDojahHttpGet<T>(
    operation: string,
    meta: Record<string, unknown>,
    exec: () => Promise<T>,
  ): Promise<T> {
    const t0 = Date.now();
    logDojahRequest(operation, { ...meta, baseUrl: this.dojahApiBase() });
    try {
      const data = await exec();
      logDojahResponse(operation, Date.now() - t0, true, summarizeForLog(data, 900));
      return data;
    } catch (err) {
      logDojahResponse(operation, Date.now() - t0, false, summarizeError(err));
      throw err;
    }
  }

  /**
   * Optional push / automation hook: POST JSON to NRV_VERIFICATION_EVENTS_WEBHOOK_URL
   * (e.g. Firebase Cloud Function, OneSignal, or internal worker). No-op if unset.
   */
  private async emitVerificationEventWebhook(
    event: 'verification.assigned' | 'verification.submitted' | 'verification.complete',
    payload: Record<string, unknown>,
  ): Promise<void> {
    const url = process.env.NRV_VERIFICATION_EVENTS_WEBHOOK_URL?.trim();
    if (!url) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = process.env.NRV_VERIFICATION_EVENTS_WEBHOOK_SECRET?.trim();
    if (secret) headers['X-Webhook-Secret'] = secret;
    try {
      await firstValueFrom(
        this.httpService.post(
          url,
          { event, payload, sentAt: new Date().toISOString() },
          { headers, timeout: 10000 },
        ),
      );
    } catch (err: any) {
      console.error(
        `[VerificationService] webhook ${event} failed:`,
        err?.message || err,
      );
    }
  }

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
    const tier = (request as { verificationTier?: string }).verificationTier ?? 'standard';
    const bvn = dto.bvn?.trim();
    if (tier === 'premium' && !bvn) {
      throw new BadRequestException(
        'BVN is required for premium verification (used for credit bureau checks).',
      );
    }
    if (bvn) {
      dto.bvn = bvn;
    }
    const existingForInvite = await this.verificationResponseModel
      .findOne({
        verificationId: String(dto.verificationId),
        email: dto.email,
      })
      .lean();
    const created = await this.verificationResponseModel.create(dto);
    if (!existingForInvite) {
      try {
        await this.notificationsService.create({
          targetRole: 'admin',
          type: 'tenant_verification_personal_saved',
          title: 'Tenant submitted verification details',
          body: `${dto.fullName || dto.email} has started verification and saved personal information for request ${dto.verificationId}.`,
          metadata: {
            verificationRequestId: String(dto.verificationId),
            verificationResponseId: String((created as any)._id),
            tenantEmail: dto.email,
            tenantName: dto.fullName,
          },
        });
      } catch (err: any) {
        console.error(
          '[VerificationService.create] Admin notification failed:',
          err?.message || err,
        );
      }
    }
    return created;
  }

  /**
   * Update personal fields on an existing verification response (e.g. BVN backfill).
   */
  async updatePersonal(
    id: string,
    dto: { bvn?: string },
  ): Promise<VerificationResponse | null> {
    const existing = await this.verificationResponseModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Verification response not found');
    }
    const update: Record<string, string> = {};
    if (dto.bvn !== undefined) {
      update.bvn = dto.bvn.trim();
    }
    if (Object.keys(update).length === 0) {
      return existing;
    }
    const request = await this.verificationModel.findById(existing.verificationId);
    const tier = (request as { verificationTier?: string } | null)?.verificationTier ?? 'standard';
    if (tier === 'premium' && !update.bvn) {
      throw new BadRequestException(
        'BVN is required for premium verification (used for credit bureau checks).',
      );
    }
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Verification response not found');
    }
    return updated;
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
    return this.refreshLandlordReportAfterTenantDataUpdate(updated);
  }

  /**
   * Update guarantor info for a verification response
   * @param id
   * @param dto
   * @returns Updated verification response or null
   */
  async updateGuarantor(id: string, dto: UpdateGuarantorDto): Promise<VerificationResponse | null> {
    const updated = await this.verificationResponseModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) {
      return null;
    }
    return this.refreshLandlordReportAfterTenantDataUpdate(updated);
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

    const prior = await this.verificationResponseModel.findById(id).lean();
    const updated = await this.verificationResponseModel.findByIdAndUpdate(id, updatePayload, {
      new: true,
    });
    if (
      updated?.bankStatementUrl &&
      updated.utilityBillUrl &&
      updated.identificationDocumentUrl &&
      !(prior as { adminDocumentsSubmittedNotifiedAt?: Date })?.adminDocumentsSubmittedNotifiedAt
    ) {
      try {
        await this.notificationsService.create({
          targetRole: 'admin',
          type: 'tenant_verification_submitted',
          title: 'Verification documents submitted',
          body: `${updated.fullName || updated.email || 'A tenant'} uploaded all required documents for verification request ${updated.verificationId ?? id}.`,
          metadata: {
            verificationResponseId: id,
            verificationRequestId: String(updated.verificationId ?? ''),
            tenantEmail: updated.email,
            tenantName: updated.fullName,
          },
        });
        const vreq = updated.verificationId
          ? await this.verificationModel.findById(updated.verificationId).lean()
          : null;
        const landlordUserId = (vreq as any)?.requestedBy
          ? String((vreq as any).requestedBy)
          : '';
        if (landlordUserId) {
          await this.notificationsService.create({
            targetRole: 'landlord',
            userId: landlordUserId,
            type: 'verification_documents_uploaded',
            title: 'Tenant uploaded verification documents',
            body: `${updated.fullName || updated.email || 'Your tenant'} submitted bank statement, utility bill, and ID for your verification request.`,
            metadata: {
              verificationResponseId: id,
              verificationRequestId: String(updated.verificationId ?? ''),
              tenantEmail: updated.email,
              tenantName: updated.fullName,
            },
          });
        }
        await this.emailService.sendVerificationDocumentsSubmittedAdminEmail({
          tenantName: updated.fullName || '',
          tenantEmail: updated.email || '',
          verificationRequestId: String(updated.verificationId ?? ''),
          verificationResponseId: id,
        });
        await this.emitVerificationEventWebhook('verification.submitted', {
          verificationRequestId: String(updated.verificationId ?? ''),
          verificationResponseId: id,
          tenantEmail: updated.email,
          tenantName: updated.fullName,
        });
        await this.verificationResponseModel.findByIdAndUpdate(id, {
          adminDocumentsSubmittedNotifiedAt: new Date(),
        });
      } catch (notifyErr: any) {
        console.error(
          '[uploadAffordability] Notifications / email / webhook failed:',
          notifyErr?.message || notifyErr,
        );
      }
    }
    return await this.verificationResponseModel.findById(id);
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

      try {
        const tenantUser =
          existingUser ?? (await this.userService.findUserByEmail(dto.email));
        const tenantId = (tenantUser as any)?._id?.toString?.();
        if (tenantId) {
          await this.notificationsService.create({
            targetRole: 'tenant',
            userId: tenantId,
            type: 'verification_assigned',
            title: 'New verification request',
            body: `${created.landlordDisplayName} invited you to complete a tenant verification.`,
            metadata: {
              verificationRequestId: String(created._id),
              landlordName: created.landlordDisplayName,
              uniqueId: created.uniqueId,
            },
          });
          await this.emitVerificationEventWebhook('verification.assigned', {
            verificationRequestId: String(created._id),
            tenantUserId: tenantId,
            tenantEmail: dto.email,
            landlordName: created.landlordDisplayName,
            uniqueId: created.uniqueId,
          });
        }
      } catch (notifyErr: any) {
        console.error(
          '[createVerificationRequest] In-app / webhook notification failed:',
          notifyErr?.message || notifyErr,
        );
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
    const doc = await this.verificationResponseModel.findOne({ _id: id }).lean();
    const refreshed = await this.withFreshLandlordReportScoring(doc);
    return (refreshed as unknown as VerificationResponse | null) ?? null;
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
    return this.withFreshLandlordReportScoring(doc);
  }

  /** Recompute risk breakdown / score on read so API matches current tier weights and tenant fields. */
  private async withFreshLandlordReportScoring(
    doc: Record<string, unknown> | null,
  ): Promise<Record<string, unknown> | null> {
    if (!doc) {
      return null;
    }
    const tier = await this.getVerificationTierForResponse(
      doc.verificationId as string | undefined,
    );
    return this.applyFreshLandlordReportScoring(
      doc as unknown as VerificationResponse & {
        landlordReport?: Record<string, unknown> | null;
      },
      tier,
    ) as unknown as Record<string, unknown>;
  }

  /**
   * Get available verification statuses
   * @returns Array of status options
   */
  async getVerificationStatuses() {
    return [
      { value: '', label: 'All Status' },
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Verification completed' },
      { value: 'rejected', label: 'Rejected' },
    ];
  }

  async verifyBvnWithDojah(bvn: string) {
    const appId = process.env.DOJAH_APP_ID;
    const authKey = process.env.DOJAH_AUTH_KEY;
    if (!appId || !authKey) {
      throw new InternalServerErrorException('Dojah API credentials not set');
    }
    const url = `${this.dojahApiBase()}/api/v1/kyc/bvn/advance?bvn=${encodeURIComponent(bvn)}`;
    try {
      return await this.traceDojahHttpGet(
        'verifyBvnWithDojah',
        { bvn: maskDigits(bvn) },
        async () =>
          (
            await firstValueFrom(
              this.httpService.get(url, {
                headers: {
                  AppId: appId,
                  Authorization: authKey,
                },
              }),
            )
          ).data,
      );
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
    const normalizedPhone = formatPhoneForDojah(phone);
    const url = `${this.dojahApiBase()}/api/v1/kyc/phone_number/basic?phone_number=${encodeURIComponent(normalizedPhone)}`;
    try {
      return await this.traceDojahHttpGet(
        'verifyPhoneNumberBasic',
        { phone: maskDigits(normalizedPhone, 4) },
        async () =>
          (
            await firstValueFrom(
              this.httpService.get(url, {
                headers: {
                  AppId: appId,
                  Authorization: authKey,
                },
              }),
            )
          ).data,
      );
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
    let phoneToVerify: string;
    if (useDojahTestIdentifiers()) {
      phoneToVerify = formatPhoneForDojah(getDojahTestPhone());
    } else {
      const trimmed = phone?.trim();
      if (!trimmed) {
        throw new BadRequestException('Phone number is required');
      }
      phoneToVerify = formatPhoneForDojah(trimmed);
    }
    try {
      const verificationResult = await this.verifyPhoneNumberBasic(phoneToVerify);
      
      // Update the verification response with the complete phone verification result
      const updateData = {
        phoneVerificationResult: {
          status: verificationResult.status || 'success',
          data: verificationResult.data || verificationResult,
          entity: verificationResult.entity || null,
          originalPhone: phone,
          finalPhone: phoneToVerify,
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
      logDojahDbUpdate('verifyPhoneAndStoreResult', {
        responseId,
        phoneVerificationStatus: updateData.phoneVerificationStatus,
        preview: summarizeForLog(updateData.phoneVerificationResult, 500),
      });
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
      logDojahDbUpdate('verifyPhoneAndStoreResult_failed', {
        responseId,
        phoneVerificationStatus: errorData.phoneVerificationStatus,
        preview: summarizeForLog(errorData.phoneVerificationResult, 500),
      });
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
    const submittedNin = nin.trim();
    const ninToVerify = useDojahTestIdentifiers()
      ? getDojahTestNin()
      : submittedNin;

    const existingResponse = await this.verificationResponseModel.findById(responseId);
    if (!existingResponse) {
      throw new BadRequestException('Verification response not found');
    }
    const applicantFullName = existingResponse.fullName;
    const applicantDob = existingResponse.dateOfBirth;

    try {
      const verificationResult = await this.verifyNinBasic(ninToVerify);
      const entity = resolveDojahNinEntity(verificationResult);
      const { namesMatch, dobMatch } = checkNinNameAlignment(
        entity,
        applicantFullName,
        applicantDob,
      );

      const updateData = {
        nin: submittedNin,
        ninVerificationResult: {
          status: verificationResult?.status || 'success',
          data: verificationResult?.data ?? verificationResult,
          entity: entity ?? verificationResult?.entity ?? null,
          originalNin: submittedNin,
          ...verificationResult,
          namesMatch,
          dobMatch,
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
      await this.touchDojahCheckCache(responseId, 'nin', { nin: submittedNin });
      logDojahDbUpdate('verifyNinAndStoreResult', {
        responseId,
        nin: maskDigits(submittedNin),
        ninVerificationStatus: updateData.ninVerificationStatus,
        namesMatch: updateData.ninVerificationResult?.namesMatch,
        dobMatch: updateData.ninVerificationResult?.dobMatch,
        preview: summarizeForLog(updateData.ninVerificationResult, 500),
      });
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
      logDojahDbUpdate('verifyNinAndStoreResult_failed', {
        responseId,
        nin: maskDigits(submittedNin),
        ninVerificationStatus: errorData.ninVerificationStatus,
        preview: summarizeForLog(errorData.ninVerificationResult, 500),
      });
      return updatedResponse;
    }
  }

  /**
   * Store credit summary result on a verification response (side-effect for Dojah call).
   */
  async storeCreditSummary(
    responseId: string,
    creditSummary: any,
    bvn?: string,
  ) {
    if (!responseId) {
      return null;
    }
    const existing = await this.verificationResponseModel.findById(responseId).lean();
    const snapshot = parseCreditFinancialSnapshot(
      creditSummary as Record<string, unknown>,
      existing?.monthlyIncome ?? null,
    );
    const bvnTrim = (bvn ?? existing?.bvn ?? '').trim();
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      responseId,
      { creditSummary, creditFinancialSnapshot: snapshot as unknown as Record<string, unknown> },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Verification response not found');
    }
    if (bvnTrim) {
      await this.touchDojahCheckCache(responseId, 'creditSummary', { bvn: bvnTrim });
    }
    logDojahDbUpdate('storeCreditSummary', {
      responseId,
      affordabilityBand: snapshot.affordabilityBand,
      landlordCreditOutcome: snapshot.landlordCreditOutcome,
      preview: summarizeForLog(creditSummary, 600),
    });
    return updated;
  }

  /**
   * Store AML screening result on a verification response.
   */
  async storeAmlScreeningResult(
    responseId: string,
    amlScreeningResult: any,
    amlInputKey?: string,
  ) {
    if (!responseId) {
      return null;
    }
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      responseId,
      { amlScreeningResult },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Verification response not found');
    }
    if (amlInputKey) {
      await this.touchDojahCheckCache(responseId, 'aml', { amlInputKey });
    }
    logDojahDbUpdate('storeAmlScreeningResult', {
      responseId,
      preview: summarizeForLog(amlScreeningResult, 600),
    });
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
    const useTestAml = useDojahTestIdentifiers();
    const params = useTestAml
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
    if (!useTestAml && !params.names) {
      throw new BadRequestException('Applicant name is required for AML screening');
    }
    const result = await this.dojahTierService.amlScreeningV2Individual(params);
    const amlInputKey = buildAmlInputKey({
      fullName: response.fullName,
      dateOfBirth: response.dateOfBirth,
      gender: response.gender,
    });
    await this.storeAmlScreeningResult(responseId, result, amlInputKey);
    return result;
  }

  /**
   * Store phone fraud screening result on a verification response (side-effect for Dojah call).
   */
  async storePhoneFraudResult(
    responseId: string,
    phoneFraudResult: any,
    phone?: string,
  ) {
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
    const phoneRaw = (phone ?? updated.phone ?? '').trim();
    if (phoneRaw) {
      await this.touchDojahCheckCache(responseId, 'phoneFraud', {
        phone: formatPhoneForDojah(phoneRaw),
      });
    }
    logDojahDbUpdate('storePhoneFraudResult', {
      responseId,
      preview: summarizeForLog(phoneFraudResult, 600),
    });
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

      const idNinAlignment = getIdDocumentNinAlignment(
        analysis as Record<string, unknown>,
        response.ninVerificationResult,
      );

      const updated = await this.verificationResponseModel.findByIdAndUpdate(
        responseId,
        {
          identificationDocumentAnalysis: {
            ...analysis,
            idNinAlignment,
            timestamp: new Date(),
          },
        },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Verification response not found');
      }
      const documentUrl = response.identificationDocumentUrl?.trim() ?? '';
      if (documentUrl) {
        await this.touchDojahCheckCache(responseId, 'idDocument', { documentUrl });
      }
      logDojahDbUpdate('analyzeIdentificationDocument', {
        responseId,
        outcome: identificationDocumentAnalysisOutcome(analysis),
        idNinAlignment,
      });
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
      logDojahDbUpdate('analyzeIdentificationDocument_failed', {
        responseId,
        preview: summarizeForLog(
          {
            status: 'failed',
            error: error?.response?.data || error?.message || 'Document analysis failed',
          },
          400,
        ),
      });
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
      const billUrlForDojah = toDojahUtilityBillImageUrl(response.utilityBillUrl);
      const analysis = await this.dojahTierService.utilityBillAnalysis({
        input_type: 'url',
        input_value: billUrlForDojah,
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
      const billUrl = response.utilityBillUrl?.trim() ?? '';
      if (billUrl) {
        await this.touchDojahCheckCache(responseId, 'utilityBill', { billUrl });
      }
      logDojahDbUpdate('analyzeUtilityBill', {
        responseId,
        outcome: utilityBillAnalysisOutcome(analysis),
      });
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
      logDojahDbUpdate('analyzeUtilityBill_failed', {
        responseId,
        preview: summarizeForLog(
          {
            status: 'failed',
            error: error?.response?.data || error?.message || 'Utility bill analysis failed',
          },
          400,
        ),
      });
      return updated;
    }
  }

  /**
   * Compute Tenant Trust Score (0–100), risk category, and recommendation from verification outcomes.
   * Premium: Identity 27, Contact 16, Employment 18, Financial 18, Guarantor 12, Compliance 9 (= 100).
   * Standard: no rental or credit bureau; those weights scale the five included categories to 100.
   */
  private finalizeTenantTrustAssessment(
    baseScore: number,
    doc: DocForRisk,
    tier: 'standard' | 'premium' = 'standard',
  ): { riskScore: number; riskCategory: string; recommendation: string } {
    let riskScore = Math.max(0, Math.min(100, baseScore));
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

    const snap = doc.creditFinancialSnapshot as unknown as
      | CreditFinancialSnapshot
      | null
      | undefined;
    if (tier === 'premium' && doc.bvn?.trim() && snap?.status === 'ok') {
      if (snap.affordabilityBand === 'high_risk') {
        riskScore = Math.min(riskScore, 62);
        riskCategory = 'Elevated Risk';
        recommendation =
          'Credit bureau indicates high debt relative to stated income — request proof of affordability or a guarantor before approving.';
      } else if (snap.affordabilityBand === 'stretched') {
        riskScore = Math.min(riskScore, 72);
        if (riskScore < 65) {
          riskCategory = 'Elevated Risk';
        } else {
          riskCategory = 'Moderate Risk';
        }
        recommendation =
          'Proceed with caution — bureau data suggests stretched finances; confirm rent is affordable vs income and existing debt.';
      } else if (snap.affordabilityBand === 'strong') {
        if (riskScore >= 65 && riskScore < 80) {
          recommendation =
            'Proceed with caution on open items — credit bureau profile supports stated affordability.';
        }
      }
    } else if (tier === 'premium' && doc.bvn?.trim() && snap?.status === 'error') {
      riskScore = Math.min(riskScore, 68);
      recommendation =
        'Credit bureau check could not be completed — verify affordability manually before lease approval.';
    } else if (tier === 'premium' && doc.bvn?.trim() && snap?.status === 'no_hit') {
      riskScore = Math.min(riskScore, 75);
      recommendation =
        'No credit bureau record found — rely on stated income, payslips, and employment verification for affordability.';
    }

    return { riskScore, riskCategory, recommendation };
  }

  private buildScoredLandlordRiskArtifacts(
    docForRisk: DocForRisk,
    report: LandlordReportForRisk,
    tier: 'standard' | 'premium',
  ) {
    const riskBreakdown = buildTenantRiskBreakdown(docForRisk, report, tier);
    const baseScore = sumRiskBreakdownEarned(riskBreakdown);
    const { riskScore, riskCategory, recommendation } = this.finalizeTenantTrustAssessment(
      baseScore,
      docForRisk,
      tier,
    );
    const finalBreakdown =
      riskScore < baseScore
        ? alignBreakdownEarnedToTotal(riskBreakdown, riskScore)
        : riskBreakdown;
    const checkSummaries = buildRedactedVerificationCheckSummaries(docForRisk, tier);
    return {
      riskScore,
      riskCategory,
      recommendation,
      riskBreakdown: finalBreakdown,
      checkSummaries,
    };
  }

  /**
   * Map admin section review status to landlord summary bucket (case-insensitive, synonyms).
   */
  private normalizeSectionReportInput(report: {
    status: string;
    comment: string;
    reviewedBy: string;
    reviewedAt: Date;
  }) {
    return {
      ...report,
      status: String(report.status ?? '').trim().toLowerCase(),
    };
  }

  private mapReportSectionToLandlordSummary(
    r: { status?: string } | null | undefined,
  ): 'approved' | 'rejected' | 'pending' | 'not_reviewed' {
    if (!r) return 'not_reviewed';
    const s = String(r.status ?? '')
      .trim()
      .toLowerCase();
    if (!s) return 'pending';
    if (['approved', 'verified', 'completed', 'complete'].includes(s)) return 'approved';
    if (['rejected', 'failed', 'declined'].includes(s)) return 'rejected';
    if (['pending', 'under_review', 'under review'].includes(s)) return 'pending';
    return 'pending';
  }

  /**
   * Build a privacy-safe landlord summary report from a verification response (no PII).
   */
  private async getVerificationTierForResponse(
    verificationId: string | undefined | null,
  ): Promise<'standard' | 'premium'> {
    if (!verificationId) {
      return 'standard';
    }
    const request = await this.verificationModel.findById(verificationId).lean();
    return (request as { verificationTier?: string } | null)?.verificationTier === 'premium'
      ? 'premium'
      : 'standard';
  }

  /**
   * Recompute risk breakdown / score from current tenant fields (employment, guarantor)
   * while keeping stored automated check outcomes (NIN, phone, etc.).
   */
  private applyFreshLandlordReportScoring(
    doc: VerificationResponse & { landlordReport?: Record<string, unknown> | null },
    tier: 'standard' | 'premium',
  ): VerificationResponse & { landlordReport?: Record<string, unknown> | null } {
    const lr = doc.landlordReport;
    if (!lr) {
      return doc;
    }
    const report = this.landlordReportForRiskFromStored(lr);
    const docForRisk = buildDocForRiskFromResponse(
      doc as unknown as Record<string, unknown>,
    );
    const storedSnapshot = doc.creditFinancialSnapshot as unknown as
      | CreditFinancialSnapshot
      | null
      | undefined;
    if (storedSnapshot) {
      docForRisk.creditFinancialSnapshot = storedSnapshot;
    }
    const { riskScore, riskCategory, recommendation, riskBreakdown, checkSummaries } =
      this.buildScoredLandlordRiskArtifacts(docForRisk, report, tier);
    return {
      ...doc,
      landlordReport: {
        ...lr,
        riskScore,
        riskCategory,
        recommendation,
        riskBreakdown,
        checkSummaries,
      },
    };
  }

  private landlordReportForRiskFromStored(
    lr: Record<string, unknown>,
  ): LandlordReportForRisk {
    return {
      nin: String(lr.nin ?? 'not_run'),
      aml: String(lr.aml ?? 'not_run'),
      phone: String(lr.phone ?? 'not_run'),
      idDocument: String(lr.idDocument ?? 'not_run'),
      utilityBill: String(lr.utilityBill ?? 'not_run'),
      personalSection: String(lr.personalSection ?? 'not_reviewed'),
      employmentSection: String(lr.employmentSection ?? 'not_reviewed'),
      guarantorSection: String(lr.guarantorSection ?? 'not_reviewed'),
      documentsSection: String(lr.documentsSection ?? 'not_reviewed'),
      creditSummary: lr.creditSummary != null ? String(lr.creditSummary) : undefined,
    };
  }

  private async refreshLandlordReportAfterTenantDataUpdate(
    doc: VerificationResponse,
  ): Promise<VerificationResponse> {
    if (!doc.landlordReport) {
      return doc;
    }
    const tier = await this.getVerificationTierForResponse(doc.verificationId);
    const landlordReport = this.buildLandlordReport(
      doc as VerificationResponse & { landlordReport?: unknown },
      tier,
    );
    const responseId = String((doc as { _id?: unknown; id?: unknown })._id ?? (doc as { id?: unknown }).id ?? '');
    if (!responseId) {
      return doc;
    }
    const updated = await this.verificationResponseModel.findByIdAndUpdate(
      responseId,
      { $set: { landlordReport } },
      { new: true },
    );
    return updated ?? doc;
  }

  private buildLandlordReport(
    doc: VerificationResponse & { landlordReport?: any },
    tier: 'standard' | 'premium' = 'standard',
  ): NonNullable<VerificationResponse['landlordReport']> {
    const ninStatus = doc.nin
      ? (doc.ninVerificationStatus === 'completed' || doc.ninVerificationResult?.status === 'success' ? 'verified' : 'failed')
      : 'not_provided';
    const amlEntity = doc.amlScreeningResult?.entity as { risk_level?: string } | undefined;
    const amlRisk = amlEntity?.risk_level === 'low' ? 'low_risk' : amlEntity?.risk_level === 'high' ? 'high_risk' : amlEntity?.risk_level === 'medium' ? 'medium_risk' : doc.amlScreeningResult ? 'low_risk' : 'not_run';
    const amlFinal = doc.amlScreeningResult ? (amlRisk === 'low_risk' || amlRisk === 'medium_risk' || amlRisk === 'high_risk' ? amlRisk : 'low_risk') : 'not_run';
    const phoneStatus = doc.phone
      ? (doc.phoneFraudResult ? (doc.phoneFraudResult as any)?.entity?.valid === true ? 'valid' : 'invalid' : 'not_run')
      : 'not_provided';
    const storedSnapshot = doc.creditFinancialSnapshot as unknown as
      | CreditFinancialSnapshot
      | null
      | undefined;
    const snapshot =
      storedSnapshot ??
      parseCreditFinancialSnapshot(
        doc.creditSummary as Record<string, unknown> | null,
        coerceMonthlyIncome(doc.monthlyIncome),
      );
    const creditStatus = resolveLandlordCreditOutcome(snapshot, !!doc.bvn?.trim());
    const financialAffordability =
      snapshot.status === 'ok'
        ? snapshot.affordabilityBand
        : snapshot.status === 'not_run'
          ? 'not_run'
          : 'unknown';
    const idDocStatus = resolveIdDocumentLandlordStatus(
      doc.identificationDocumentUrl,
      doc.identificationDocumentAnalysis as Record<string, unknown> | null | undefined,
      doc.ninVerificationResult,
    );
    const utilStatus = resolveUtilityBillLandlordStatus(
      doc.utilityBillUrl,
      doc.utilityBillAnalysis as Record<string, unknown> | null | undefined,
    );
    const personalSection = this.mapReportSectionToLandlordSummary(doc.personalReport);
    const employmentSection = this.mapReportSectionToLandlordSummary(doc.employmentReport);
    const guarantorSection = this.mapReportSectionToLandlordSummary(doc.guarantorReport);
    const documentsSection = this.mapReportSectionToLandlordSummary(doc.documentsReport);
    const report = {
      generatedAt: new Date(),
      nin: ninStatus,
      aml: amlFinal,
      phone: phoneStatus,
      creditSummary: creditStatus,
      financialAffordability,
      creditDebtToIncomeRatio: snapshot.debtToIncomeRatio,
      idDocument: idDocStatus,
      utilityBill: utilStatus,
      personalSection,
      employmentSection,
      guarantorSection,
      documentsSection,
    };
    const docForRisk: DocForRisk = {
      ...buildDocForRiskFromResponse(doc as unknown as Record<string, unknown>),
      creditFinancialSnapshot: snapshot,
    };
    const { riskScore, riskCategory, recommendation, riskBreakdown, checkSummaries } =
      this.buildScoredLandlordRiskArtifacts(docForRisk, report, tier);
    return {
      ...report,
      riskScore,
      riskCategory,
      recommendation,
      riskBreakdown,
      checkSummaries,
    } as NonNullable<VerificationResponse['landlordReport']>;
  }

  /**
   * Which automated checks should be retried after an initial run-all.
   */
  private getFailedVerificationCheckKeys(
    doc: VerificationResponse & { landlordReport?: any; bvn?: string },
    tier: 'standard' | 'premium',
  ): VerificationCheckKey[] {
    const keys = new Set<VerificationCheckKey>();

    if (doc.nin?.trim()) {
      const ninResult = doc.ninVerificationResult as
        | { status?: string; namesMatch?: boolean }
        | undefined;
      const ninFailed =
        doc.ninVerificationStatus === 'failed' ||
        ninResult?.status === 'failed' ||
        doc.landlordReport?.nin === 'failed';
      const ninNeverSucceeded =
        doc.allChecksCompletedAt && !doc.ninVerificationResult;
      const alignment = getNinAlignmentForDoc(doc);
      const ninNamesMismatch = !alignment.namesMatch && !!ninResult;
      const ninDobMismatch = !alignment.dobMatch && !!ninResult;
      if (ninFailed || ninNeverSucceeded || ninNamesMismatch || ninDobMismatch) {
        keys.add('nin');
      }
    }

    if (doc.phone?.trim()) {
      const phoneFailed =
        !!(doc.phoneFraudResult as { error?: unknown } | undefined)?.error ||
        doc.landlordReport?.phone === 'invalid' ||
        (doc.landlordReport?.phone === 'not_run' && !!doc.allChecksCompletedAt);
      if (phoneFailed) {
        keys.add('phoneFraud');
      }
    }

    if (tier === 'premium' && doc.bvn?.trim()) {
      const snap =
        (doc.creditFinancialSnapshot as unknown as CreditFinancialSnapshot | null | undefined) ??
        parseCreditFinancialSnapshot(
          doc.creditSummary as Record<string, unknown> | null,
          doc.monthlyIncome ?? null,
        );
      const creditFailed =
        snap.status === 'error' ||
        (snap.status === 'not_run' && !!doc.allChecksCompletedAt);
      if (creditFailed && doc.allChecksCompletedAt) {
        keys.add('creditSummary');
      }
    }

    if (
      !doc.amlScreeningResult ||
      !!(doc.amlScreeningResult as { error?: unknown })?.error ||
      doc.landlordReport?.aml === 'not_run'
    ) {
      if (doc.allChecksCompletedAt) {
        keys.add('aml');
      }
    }

    if (doc.identificationDocumentUrl) {
      const idStatus = resolveIdDocumentLandlordStatus(
        doc.identificationDocumentUrl,
        doc.identificationDocumentAnalysis as Record<string, unknown> | null | undefined,
        doc.ninVerificationResult,
      );
      if (idStatus === 'failed' || idStatus === 'not_run') {
        keys.add('idDocument');
      }
    }

    if (doc.utilityBillUrl) {
      const analysis = doc.utilityBillAnalysis as { status?: string } | null;
      if (
        !analysis ||
        analysis.status === 'failed' ||
        doc.landlordReport?.utilityBill === 'failed' ||
        doc.landlordReport?.utilityBill === 'not_run'
      ) {
        keys.add('utilityBill');
      }
    }

    return Array.from(keys);
  }

  private emptyChecksSummary(): VerificationChecksSummary {
    return {
      nin: 'skipped',
      phoneFraud: 'skipped',
      creditSummary: 'skipped',
      aml: 'skipped',
      idDocument: 'skipped',
      utilityBill: 'skipped',
    };
  }

  private async touchDojahCheckCache(
    responseId: string,
    check: VerificationCheckKey,
    meta: Omit<DojahCheckCacheEntry, 'at'>,
  ): Promise<void> {
    const entry: DojahCheckCacheEntry = { at: new Date(), ...meta };
    // Dot-path $set fails when dojahCheckCache is null on the document.
    await this.verificationResponseModel.findByIdAndUpdate(responseId, [
      {
        $set: {
          dojahCheckCache: {
            $mergeObjects: [
              { $ifNull: ['$dojahCheckCache', {}] },
              { $literal: { [check]: entry } },
            ],
          },
        },
      },
    ]);
  }

  private async getVerificationResponseDoc(responseId: string) {
    const doc = await this.verificationResponseModel.findById(responseId).lean();
    if (!doc) {
      throw new BadRequestException('Verification response not found');
    }
    return doc;
  }

  private async runSingleVerificationCheck(
    responseId: string,
    _response: VerificationResponse & { bvn?: string },
    tier: 'standard' | 'premium',
    check: VerificationCheckKey,
    forceRefresh = false,
  ): Promise<VerificationCheckRunStatus> {
    try {
      const fresh = await this.getVerificationResponseDoc(responseId);
      const cacheLookup = canReuseDojahCheck(check, fresh as any, forceRefresh);
      if (cacheLookup.hit) {
        logDojahRequest('runSingleVerificationCheck_cache_hit', {
          responseId,
          check,
          reason: cacheLookup.reason,
        });
        return 'cached';
      }

      switch (check) {
        case 'nin':
          if (!fresh.nin?.trim()) {
            return 'skipped';
          }
          await this.verifyNinAndStoreResult(responseId, fresh.nin.trim());
          return 'ok';
        case 'phoneFraud':
          if (!fresh.phone?.trim()) {
            return 'skipped';
          }
          {
            const phone = fresh.phone.trim();
            const result = await this.dojahTierService.phoneFraudScreen(phone);
            await this.storePhoneFraudResult(responseId, result, phone);
          }
          return 'ok';
        case 'creditSummary': {
          const bvn = fresh.bvn?.trim();
          if (tier !== 'premium' || !bvn) {
            return 'skipped';
          }
          const result = await this.dojahTierService.creditSummary(bvn);
          await this.storeCreditSummary(responseId, result, bvn);
          return 'ok';
        }
        case 'aml':
          await this.runAmlScreeningAndStore(responseId);
          return 'ok';
        case 'idDocument':
          if (!fresh.identificationDocumentUrl) {
            return 'skipped';
          }
          await this.analyzeIdentificationDocument(responseId);
          return 'ok';
        case 'utilityBill':
          if (!fresh.utilityBillUrl) {
            return 'skipped';
          }
          await this.analyzeUtilityBill(responseId);
          return 'ok';
        default:
          return 'skipped';
      }
    } catch {
      return 'error';
    }
  }

  private async completeVerificationCheckRun(
    responseId: string,
    summary: VerificationChecksSummary,
    verificationRequest: { verificationTier?: string } | null,
    operation: 'runAllVerificationChecks' | 'retryVerificationChecks',
    retried?: VerificationCheckKey[],
  ): Promise<{
    summary: VerificationChecksSummary;
    retried: VerificationCheckKey[];
    response: VerificationResponse;
  }> {
    const updatedDoc = await this.verificationResponseModel.findById(responseId);
    if (!updatedDoc) {
      throw new BadRequestException('Verification response not found');
    }
    const tier: 'standard' | 'premium' =
      (verificationRequest as { verificationTier?: string } | null)?.verificationTier ===
      'premium'
        ? 'premium'
        : 'standard';
    const landlordReport = this.buildLandlordReport(
      updatedDoc as VerificationResponse & { landlordReport?: any },
      tier,
    );
    await this.verificationResponseModel.findByIdAndUpdate(responseId, {
      allChecksCompletedAt: new Date(),
      landlordReport,
    });
    logDojahDbUpdate(`${operation}_complete`, {
      responseId,
      tier: (verificationRequest as any)?.verificationTier ?? 'standard',
      summary,
      retried: retried ?? [],
      riskScore: landlordReport.riskScore,
      riskCategory: landlordReport.riskCategory,
      idDocumentOutcome: identificationDocumentAnalysisOutcome(
        updatedDoc.identificationDocumentAnalysis,
      ),
      utilityBillOutcome: utilityBillAnalysisOutcome(updatedDoc.utilityBillAnalysis),
    });

    const adminScreeningAlreadyNotified = !!(updatedDoc as {
      adminScreeningCompleteNotifiedAt?: Date;
    }).adminScreeningCompleteNotifiedAt;
    if (!adminScreeningAlreadyNotified) {
      try {
        await this.notificationsService.create({
          targetRole: 'admin',
          type: 'verification_ready_for_admin_review',
          title: 'Tenant verification screening complete',
          body: `${updatedDoc.fullName || updatedDoc.email}: automated checks finished. Risk: ${landlordReport.riskCategory ?? 'n/a'}. Ready for admin review.`,
          metadata: {
            verificationResponseId: responseId,
            verificationRequestId: String(updatedDoc.verificationId ?? ''),
            tenantEmail: updatedDoc.email,
            tenantName: updatedDoc.fullName,
            riskCategory: landlordReport.riskCategory,
          },
        });
        await this.verificationResponseModel.findByIdAndUpdate(responseId, {
          adminScreeningCompleteNotifiedAt: new Date(),
        });
      } catch (adminNotifyErr: any) {
        console.error(
          `[${operation}] Admin hub notification failed:`,
          adminNotifyErr?.message || adminNotifyErr,
        );
      }
    }

    try {
      const landlordRef = (verificationRequest as any)?.requestedBy;
      const landlordId = landlordRef
        ? typeof landlordRef === 'object' && landlordRef && '_id' in landlordRef
          ? String((landlordRef as any)._id)
          : String(landlordRef)
        : '';
      const alreadyNotified = !!(updatedDoc as {
        landlordScreeningCompleteNotifiedAt?: Date;
      }).landlordScreeningCompleteNotifiedAt;
      if (landlordId && !alreadyNotified) {
        await this.notificationsService.create({
          targetRole: 'landlord',
          userId: landlordId,
          type: 'verification_complete',
          title: 'Tenant verification complete',
          body: `Automated screening finished for ${updatedDoc.fullName || 'your tenant'}. Review the verification report in your dashboard.`,
          metadata: {
            verificationResponseId: responseId,
            verificationRequestId: String(updatedDoc.verificationId ?? ''),
            tenantEmail: updatedDoc.email,
          },
        });
        try {
          const tenantAcct = await this.userService.findUserByEmail(
            updatedDoc.email || '',
          );
          const tenantUid = (tenantAcct as any)?._id?.toString?.();
          if (tenantUid) {
            await this.notificationsService.create({
              targetRole: 'tenant',
              userId: tenantUid,
              type: 'verification_screening_complete',
              title: 'Your verification screening is complete',
              body: 'Automated checks have finished. Your landlord can review the report; you may check your verification status in the app.',
              metadata: {
                verificationResponseId: responseId,
                verificationRequestId: String(updatedDoc.verificationId ?? ''),
              },
            });
          }
        } catch {
          // best-effort tenant notify
        }
        const landlordUser = await this.userService.findUserById(landlordId);
        const lu = landlordUser as any;
        const landlordEmail = lu?.email ? String(lu.email) : '';
        const landlordName =
          [lu?.firstName, lu?.lastName].filter(Boolean).join(' ') || 'there';
        const fe = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
          /\/+$/,
          '',
        );
        const tenantEmailEnc = encodeURIComponent(updatedDoc.email || '');
        const actionUrl = `${fe}/dashboard/landlord/properties/verification/response/${encodeURIComponent(responseId)}?email=${tenantEmailEnc}`;
        await this.emailService.sendVerificationScreeningCompleteLandlordEmail({
          landlordEmail,
          landlordName,
          tenantName: updatedDoc.fullName || updatedDoc.email || 'Tenant',
          actionUrl,
        });
        await this.emitVerificationEventWebhook('verification.complete', {
          verificationRequestId: String(updatedDoc.verificationId ?? ''),
          verificationResponseId: responseId,
          landlordUserId: landlordId,
          tenantEmail: updatedDoc.email,
          tenantName: updatedDoc.fullName,
        });
        await this.verificationResponseModel.findByIdAndUpdate(responseId, {
          landlordScreeningCompleteNotifiedAt: new Date(),
        });
      }
    } catch (notifyErr: any) {
      console.error(
        `[${operation}] Landlord notifications / email / webhook failed:`,
        notifyErr?.message || notifyErr,
      );
    }

    const updated = await this.verificationResponseModel.findById(responseId);
    return {
      summary,
      retried: retried ?? [],
      response: updated!,
    };
  }

  /**
   * Re-run automated checks that failed or did not complete on the last run-all.
   */
  async retryVerificationChecks(
    responseId: string,
    forceRefresh = false,
  ): Promise<{
    summary: VerificationChecksSummary;
    retried: VerificationCheckKey[];
    response: VerificationResponse;
  }> {
    const response = await this.verificationResponseModel.findById(responseId);
    if (!response) {
      throw new BadRequestException('Verification response not found');
    }
    if (!response.allChecksCompletedAt) {
      throw new BadRequestException(
        'Run all checks first before retrying failed steps.',
      );
    }

    const verificationRequest = response.verificationId
      ? await this.verificationModel.findById(response.verificationId).lean()
      : null;
    const tier: 'standard' | 'premium' =
      (verificationRequest as { verificationTier?: string } | null)
        ?.verificationTier === 'premium'
        ? 'premium'
        : 'standard';

    const checksToRetry = this.getFailedVerificationCheckKeys(
      response as VerificationResponse & { landlordReport?: any; bvn?: string },
      tier,
    );

    if (checksToRetry.length === 0) {
      return {
        summary: this.emptyChecksSummary(),
        retried: [],
        response,
      };
    }

    logDojahRequest('retryVerificationChecks', {
      responseId,
      tier,
      checksToRetry,
      forceRefresh,
    });

    const summary = this.emptyChecksSummary();
    for (const check of checksToRetry) {
      summary[check] = await this.runSingleVerificationCheck(
        responseId,
        response as VerificationResponse & { bvn?: string },
        tier,
        check,
        forceRefresh,
      );
    }

    return this.completeVerificationCheckRun(
      responseId,
      summary,
      verificationRequest,
      'retryVerificationChecks',
      checksToRetry,
    );
  }

  /**
   * Run all verification checks in one flow. Respects the verification request's tier:
   * - Standard: NIN, phone fraud, AML, ID document, utility bill (no credit score).
   * - Premium: All of the above plus credit summary (BVN).
   * Skips steps when data is missing. Sets allChecksCompletedAt and landlord report when done.
   */
  async runAllVerificationChecks(
    responseId: string,
    forceRefresh = false,
  ): Promise<{
    summary: VerificationChecksSummary;
    retried: VerificationCheckKey[];
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

    logDojahRequest('runAllVerificationChecks', {
      responseId,
      tier,
      verificationRequestId: String(response.verificationId ?? ''),
      forceRefresh,
    });

    const summary = this.emptyChecksSummary();
    for (const check of VERIFICATION_CHECK_KEYS) {
      summary[check] = await this.runSingleVerificationCheck(
        responseId,
        response as VerificationResponse & { bvn?: string },
        tier,
        check,
        forceRefresh,
      );
    }

    return this.completeVerificationCheckRun(
      responseId,
      summary,
      verificationRequest,
      'runAllVerificationChecks',
    );
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
    const url = `${this.dojahApiBase()}/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}`;
    try {
      return await this.traceDojahHttpGet(
        'verifyNinBasic',
        { nin: maskDigits(nin) },
        async () =>
          (
            await firstValueFrom(
              this.httpService.get(url, {
                headers: {
                  AppId: appId,
                  Authorization: authKey,
                },
              }),
            )
          ).data,
      );
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
    const url = `${this.dojahApiBase()}/api/v1/kyc/dl?dl=${encodeURIComponent(dl)}`;
    try {
      return await this.traceDojahHttpGet(
        'verifyDriversLicence',
        { dl: maskDigits(dl.replace(/\s/g, ''), 4) },
        async () =>
          (
            await firstValueFrom(
              this.httpService.get(url, {
                headers: {
                  AppId: appId,
                  Authorization: authKey,
                },
              }),
            )
          ).data,
      );
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
    const url = `${this.dojahApiBase()}/api/v1/kyc/vin?vin=${encodeURIComponent(vin)}`;
    try {
      return await this.traceDojahHttpGet(
        'verifyVotersId',
        { vin: maskDigits(vin.replace(/\s/g, ''), 4) },
        async () =>
          (
            await firstValueFrom(
              this.httpService.get(url, {
                headers: {
                  AppId: appId,
                  Authorization: authKey,
                },
              }),
            )
          ).data,
      );
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
    const docs = await this.verificationResponseModel.find({ verificationId }).lean();
    const refreshed = await Promise.all(
      docs.map((doc) => this.withFreshLandlordReportScoring(doc)),
    );
    return refreshed.filter((doc) => doc != null) as unknown as VerificationResponse[];
  }

  /**
   * Update personal report for a verification response
   */
  async updatePersonalReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const payload = this.normalizeSectionReportInput(report);
    const updated = await this.verificationResponseModel.findByIdAndUpdate(id, { personalReport: payload }, { new: true });
    if (!updated) return null;
    const tier = await this.getVerificationTierForResponse(updated.verificationId);
    const landlordReport = this.buildLandlordReport(
      updated as VerificationResponse & { landlordReport?: any },
      tier,
    );
    return this.verificationResponseModel.findByIdAndUpdate(id, { $set: { landlordReport } }, { new: true });
  }

  /**
   * Update employment report for a verification response
   */
  async updateEmploymentReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const payload = this.normalizeSectionReportInput(report);
    const updated = await this.verificationResponseModel.findByIdAndUpdate(id, { employmentReport: payload }, { new: true });
    if (!updated) return null;
    const tier = await this.getVerificationTierForResponse(updated.verificationId);
    const landlordReport = this.buildLandlordReport(
      updated as VerificationResponse & { landlordReport?: any },
      tier,
    );
    return this.verificationResponseModel.findByIdAndUpdate(id, { $set: { landlordReport } }, { new: true });
  }

  /**
   * Update guarantor report for a verification response
   */
  async updateGuarantorReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const payload = this.normalizeSectionReportInput(report);
    const updated = await this.verificationResponseModel.findByIdAndUpdate(id, { guarantorReport: payload }, { new: true });
    if (!updated) return null;
    const tier = await this.getVerificationTierForResponse(updated.verificationId);
    const landlordReport = this.buildLandlordReport(
      updated as VerificationResponse & { landlordReport?: any },
      tier,
    );
    return this.verificationResponseModel.findByIdAndUpdate(id, { $set: { landlordReport } }, { new: true });
  }

  /**
   * Update documents report for a verification response
   */
  async updateDocumentsReport(id: string, report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const payload = this.normalizeSectionReportInput(report);
    const updated = await this.verificationResponseModel.findByIdAndUpdate(id, { documentsReport: payload }, { new: true });
    if (!updated) return null;
    const tier = await this.getVerificationTierForResponse(updated.verificationId);
    const landlordReport = this.buildLandlordReport(
      updated as VerificationResponse & { landlordReport?: any },
      tier,
    );
    return this.verificationResponseModel.findByIdAndUpdate(id, { $set: { landlordReport } }, { new: true });
  }
}
