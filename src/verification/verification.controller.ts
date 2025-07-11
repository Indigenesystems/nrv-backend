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
}
