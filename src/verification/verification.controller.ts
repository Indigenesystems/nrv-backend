import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Res,
  HttpStatus,
  Patch,
  UseInterceptors,
  UploadedFiles,
  Put,
  Query,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import {
  CreateTenantVerificationDto,
  CreateVerificationDto,
  UpdateEmploymentDto,
  UpdateGuarantorDto,
  verificationSuccessResponse,
} from './dto/create-verification.dto';
import { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

// Helper for error responses
function errorResponse(res: Response, error: any, defaultMsg: string, status = HttpStatus.BAD_REQUEST) {
  return res.status(error?.status || status).json({
    status: 'error',
    message: error?.response || error?.message || defaultMsg,
  });
}

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  /**
   * Submit a tenant verification request
   * @param dto
   * @returns Success response with created verification
   */
  @Post('tenant')
  async submitTenantVerification(@Body(new ValidationPipe({ whitelist: true })) dto: CreateVerificationDto): Promise<{ status: string; message: string; data: any }> {
    try {
      const result = await this.verificationService.createVerificationRequest(dto);
      return verificationSuccessResponse('Tenant verification request submitted successfully', result);
    } catch (error) {
      console.error('Error submitting tenant verification:', error);
      throw new BadRequestException(error?.response || 'Could not submit verification request.');
    }
  }

  /**
   * Get all verifications
   * @returns Success response with all verifications
   */



  /**
   * Get available verification statuses
   * @returns Array of status options
   */
  @Get('statuses')
  async getVerificationStatuses() {
    try {
      const result = await this.verificationService.getVerificationStatuses();
      return verificationSuccessResponse('Verification statuses fetched successfully', result);
    } catch (error) {
      console.error('Error fetching verification statuses:', error);
      throw new BadRequestException(error?.response || 'Failed to fetch verification statuses.');
    }
  }

  /**
   * Get all verification requests for a given email
   * @param email
   * @returns Array of verifications
   */
  @Get('by-email')
  async getVerificationsByEmail(@Query('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email query parameter is required');
    }
    console.log({ email });
    const verifications = await this.verificationService.getVerificationsByEmail(email);
    return verificationSuccessResponse('Verifications fetched successfully', verifications);
  }

    /**
   * Verify BVN using Dojah API
   * @param bvn
   * @returns Dojah API response
   */
    @Get('/bvn')
    async verifyBvn(@Query('bvn') bvn: string) {
      if (!bvn) {
        throw new BadRequestException('bvn query parameter is required');
      }
      try {
        const result = await this.verificationService.verifyBvnWithDojah(bvn);
        return verificationSuccessResponse('BVN verification successful', result);
      } catch (error) {
        throw new BadRequestException(error?.response || error?.message || 'Failed to verify BVN');
      }
    }

     /**
   * Verify phone number using Dojah API (basic)
   * @param phone
   * @returns Dojah API response
   */
  @Get('/phone-basic')
  async verifyPhoneBasic(@Query('phone') phone: string) {
    if (!phone) {
      throw new BadRequestException('phone query parameter is required');
    }
    try {
      const result = await this.verificationService.verifyPhoneNumberBasic(phone);
      return verificationSuccessResponse('Phone number verification successful', result);
    } catch (error) {
      throw new BadRequestException(error?.response || error?.message || 'Failed to verify phone number');
    }
  }

  /**
   * Verify phone number and store result in verification response
   * @param responseId
   * @param phone
   * @returns Updated verification response with phone verification result
   */
  @Post('/phone-verify/:responseId')
  async verifyPhoneAndStore(
    @Param('responseId') responseId: string,
    @Body() body: { phone: string }
  ) {
    if (!body.phone) {
      throw new BadRequestException('phone is required in request body');
    }
    try {
      const result = await this.verificationService.verifyPhoneAndStoreResult(responseId, body.phone);
      return verificationSuccessResponse('Phone verification completed and stored', result);
    } catch (error) {
      throw new BadRequestException(error?.response || error?.message || 'Failed to verify and store phone verification');
    }
  }

  /**
   * Verify NIN using Dojah API (basic)
   * @param nin
   * @returns Dojah API response
   */
  @Get('/nin-basic')
  async verifyNinBasic(@Query('nin') nin: string) {
    if (!nin) {
      throw new BadRequestException('nin query parameter is required');
    }
    try {
      const result = await this.verificationService.verifyNinBasic(nin);
      return verificationSuccessResponse('NIN verification successful', result);
    } catch (error) {
      throw new BadRequestException(error?.response || error?.message || 'Failed to verify NIN');
    }
  }

    /**
   * Verify Driver's Licence using Dojah API (basic)
   * @param dl
   * @returns Dojah API response
   */
    @Get('/dl-basic')
    async verifyDriversLicence(@Query('dl') dl: string) {
      if (!dl) {
        throw new BadRequestException('dl query parameter is required');
      }
      try {
        const result = await this.verificationService.verifyDriversLicence(dl);
        return verificationSuccessResponse('Driver\'s Licence verification successful', result);
      } catch (error) {
        throw new BadRequestException(error?.response || error?.message || 'Failed to verify Driver\'s Licence');
      }
    }
  
    /**
     * Verify Voter's ID using Dojah API (basic)
     * @param vin
     * @returns Dojah API response
     */
    @Get('/vin-basic')
    async verifyVotersId(@Query('vin') vin: string) {
      if (!vin) {
        throw new BadRequestException('vin query parameter is required');
      }
      try {
        const result = await this.verificationService.verifyVotersId(vin);
        return verificationSuccessResponse('Voter\'s ID verification successful', result);
      } catch (error) {
        throw new BadRequestException(error?.response || error?.message || 'Failed to verify Voter\'s ID');
      }
    }


  /**
   * Get all verifications for a user with search and filtering
   * @param id
   * @param res
   * @param query
   */
  @Get('user/:id')
  async getUserVerifications(
    @Param('id') id: string, 
    @Res() res: Response,
    @Query() query: {
      search?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: string;
      limit?: string;
    }
  ) {
    try {
      const result = await this.verificationService.getVerificationByUserId(id, query);
      if (!result) throw new NotFoundException('Verifications not found.');
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'User verifications fetched successfully',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('Error fetching user verifications:', error);
      return errorResponse(res, error, 'Failed to fetch verification record.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Create a verification response
   * @param dto
   * @returns The created verification response object
   */
  @Post()
  async create(@Body(new ValidationPipe({ whitelist: true })) dto: CreateTenantVerificationDto) {
    try {
      const result = await this.verificationService.create(dto);
      return result;
    } catch (error) {
      throw new BadRequestException(error?.response || 'Failed to create verification.');
    }
  }

  /**
   * Update employment information for a verification response (PATCH)
   */
  @Patch(':id/employment')
  async updateEmployment(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateEmploymentDto,
  ): Promise<{ status: string; message: string; data: any }> {
    try {
      const result = await this.verificationService.updateEmployment(id, dto);
      return verificationSuccessResponse('Employment information updated successfully', result);
    } catch (error) {
      throw new BadRequestException(error?.response || 'Failed to update employment information.');
    }
  }

  /**
   * Update employment information for a verification response (PUT)
   */
  @Put(':id/employment')
  async putUpdateEmployment(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateEmploymentDto,
  ): Promise<{ status: string; message: string; data: any }> {
    try {
      const result = await this.verificationService.updateEmployment(id, dto);
      return verificationSuccessResponse('Employment information updated successfully', result);
    } catch (error) {
      throw new BadRequestException(error?.response || 'Failed to update employment information.');
    }
  }

  /**
   * Update guarantor information for a verification response (PATCH)
   */
  @Patch(':id/guarantor')
  async updateGuarantor(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateGuarantorDto,
  ): Promise<{ status: string; message: string; data: any }> {
    try {
      const result = await this.verificationService.updateGuarantor(id, dto);
      return verificationSuccessResponse('Guarantor information updated successfully', result);
    } catch (error) {
      throw new BadRequestException(error?.response || 'Failed to update guarantor information.');
    }
  }

  /**
   * Update guarantor information for a verification response (PUT)
   */
  @Put(':id/guarantor')
  async putUpdateGuarantor(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateGuarantorDto,
  ): Promise<{ status: string; message: string; data: any }> {
    try {
      const result = await this.verificationService.updateGuarantor(id, dto);
      return verificationSuccessResponse('Guarantor information updated successfully', result);
    } catch (error) {
      throw new BadRequestException(error?.response || 'Failed to update guarantor information.');
    }
  }

  /**
   * Upload affordability documents for a verification response
   * @param id
   * @param files
   * @param res
   */
  @Post(':id/affordability')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'bankStatement', maxCount: 1 },
      { name: 'utilityBill', maxCount: 1 },
      { name: 'identificationDocument', maxCount: 1 },
    ]),
  )
  async uploadAffordability(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      bankStatement?: Express.Multer.File[];
      utilityBill?: Express.Multer.File[];
      identificationDocument?: Express.Multer.File[];
    },
    @Body() body: any,
    @Res() res: Response,
  ) {
    try {
      console.log({ files, body });
      
      const result = await this.verificationService.uploadAffordability(id, files, body);
      return res.status(HttpStatus.OK).json(verificationSuccessResponse('Affordability documents uploaded successfully', result));
    } catch (error) {
      console.error('Error uploading affordability documents:', error);
      return errorResponse(res, error, 'Failed to upload documents');
    }
  }

  /**
   * Get a verification response by ID
   * @param id
   * @returns Success response with verification response
   */
  @Get('/response/:id')
  async getVerificationResponse(@Param('id') id: string): Promise<{ status: string; message: string; data: any }> {
    try {
      const result = await this.verificationService.getVerificationResponseById(id);
      if (!result) throw new NotFoundException('Verification not found.');
      return verificationSuccessResponse('Verification fetched successfully', result);
    } catch (error) {
      console.error('Error fetching verification by ID:', error);
      throw new BadRequestException(error?.response || 'Failed to fetch verification record.');
    }
  }

  /**
   * Get the latest verification response for a user
   * @param userId
   * @returns Success response with latest verification response
   */
  @Get('/response/user/:userId')
  async getLatestVerificationResponseByUser(@Param('userId') userId: string) {
    try {
      // Find the latest verification response for this user
      const result = await this.verificationService.getLatestVerificationResponseByUser(userId);
      if (!result) throw new NotFoundException('No verification response found for this user.');
      return verificationSuccessResponse('Latest verification response fetched successfully', result);
    } catch (error) {
      console.error('Error fetching latest verification response by user:', error);
      throw new BadRequestException(error?.response || 'Failed to fetch verification response.');
    }
  }

  /**
   * Get a verification response by verification request ID and tenant email
   * @param verificationId
   * @param email
   * @returns Success response with verification response or 404 if not found
   */
  @Get('/response/by-request/:verificationId')
  async getVerificationResponseByRequestAndEmail(
    @Param('verificationId') verificationId: string,
    @Query('email') email: string,
  ) {
    if (!email) {
      throw new BadRequestException('Email query parameter is required');
    }
    const result = await this.verificationService.getVerificationResponseByRequestAndEmail(verificationId, email);
    if (!result) {
      throw new NotFoundException('Verification response not found for this request and email.');
    }
    return verificationSuccessResponse('Verification response fetched successfully', result);
  }

  /**
   * AML Screening Individual using Dojah API
   * @param body
   * @returns Dojah API response
   */
  @Post('/aml-screening')
  async amlScreening(@Body() body: {
    first_name: string;
    middle_name: string;
    last_name: string;
    date_of_birth: string;
    match_score: number;
  }) {
    if (!body.first_name || !body.middle_name || !body.last_name || !body.date_of_birth || typeof body.match_score !== 'number') {
      throw new BadRequestException('All fields (first_name, middle_name, last_name, date_of_birth, match_score) are required');
    }
    try {
      const result = await this.verificationService.amlScreeningIndividual(body);
      return verificationSuccessResponse('AML screening successful', result);
    } catch (error) {
      throw new BadRequestException(error?.response || error?.message || 'Failed to perform AML screening');
    }
  }

    /**
   * Get a single verification by ID
   * @param id
   * @returns Success response with verification
   */
    @Get(':id')
    async getOne(@Param('id') id: string): Promise<{ status: string; message: string; data: any }> {
      try {
        const result = await this.verificationService.getVerificationById(id);
        if (!result) throw new NotFoundException('Verification not found.');
        return verificationSuccessResponse('Verification fetched successfully', result);
      } catch (error) {
        console.error('Error fetching verification by ID:', error);
        throw new BadRequestException(error?.response || 'Failed to fetch verification record.');
      }
    }

  /**
   * Get all verifications (admin)
   * @returns Success response with all verifications (with search, status, pagination)
   */
  @Get()
  async getAllVerifications(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'desc' | 'asc',
  ) {
    try {
      const result = await this.verificationService.getAllVerificationsWithQuery({ search, status, page, limit, sortBy, sortOrder });
      return {
        status: 'success',
        message: 'All verifications fetched successfully',
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      throw new BadRequestException(error?.response || 'Failed to fetch verifications.');
    }
  }

  @Post('history')
  async createVerificationHistory(@Body() body: {
    userId: string;
    type: string;
    input: Record<string, any>;
    result: Record<string, any>;
    adminId: string;
    adminName: string;
  }) {
    return this.verificationService.createVerificationHistory(body);
  }

  @Get('history')
  async getVerificationHistory(@Query('userId') userId?: string) {
    return this.verificationService.getVerificationHistory(userId);
  }

  /**
   * Get all verification responses by verificationId
   */
  @Get('/response/by-verification/:verificationId')
  async getVerificationResponsesByVerificationId(
    @Param('verificationId') verificationId: string,
  ) {
    const result = await this.verificationService.getVerificationResponsesByVerificationId(verificationId);
    return verificationSuccessResponse('Verification responses fetched successfully', result);
  }

  /**
   * Update personal report for a verification response
   */
  @Patch('/response/:id/personal-report')
  async updatePersonalReport(@Param('id') id: string, @Body() report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const result = await this.verificationService.updatePersonalReport(id, report);
    return verificationSuccessResponse('Personal report updated successfully', result);
  }

  /**
   * Update employment report for a verification response
   */
  @Patch('/response/:id/employment-report')
  async updateEmploymentReport(@Param('id') id: string, @Body() report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const result = await this.verificationService.updateEmploymentReport(id, report);
    return verificationSuccessResponse('Employment report updated successfully', result);
  }

  /**
   * Update guarantor report for a verification response
   */
  @Patch('/response/:id/guarantor-report')
  async updateGuarantorReport(@Param('id') id: string, @Body() report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const result = await this.verificationService.updateGuarantorReport(id, report);
    return verificationSuccessResponse('Guarantor report updated successfully', result);
  }

  /**
   * Update documents report for a verification response
   */
  @Patch('/response/:id/documents-report')
  async updateDocumentsReport(@Param('id') id: string, @Body() report: { status: string; comment: string; reviewedBy: string; reviewedAt: Date }) {
    const result = await this.verificationService.updateDocumentsReport(id, report);
    return verificationSuccessResponse('Documents report updated successfully', result);
  }
}
