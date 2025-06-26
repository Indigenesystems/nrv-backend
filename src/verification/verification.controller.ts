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
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { Response } from 'express';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('tenant')
  async submitTenantVerification(
    @Body()
    dto: CreateVerificationDto,
  ) {
    try {
      return await this.verificationService.createVerificationRequest(dto);
    } catch (error) {
      console.error('Error submitting tenant verification:', error);
      if (error.status && error.response) {
        throw new BadRequestException(error.response);
      }
      throw new InternalServerErrorException('Could not submit verification request.');
    }
  }

  @Get()
  async getAllVerifications() {
    try {
      return await this.verificationService.getAllVerifications();
    } catch (error) {
      console.error('Error fetching verifications:', error);
      throw new InternalServerErrorException('Failed to fetch verifications.');
    }
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    try {
      const result = await this.verificationService.getVerificationById(id);
      if (!result) throw new NotFoundException('Verification not found.');
      return result;
    } catch (error) {
      console.error('Error fetching verification by ID:', error);
      if (error.status && error.response) {
        throw new BadRequestException(error.response);
      }
      throw new InternalServerErrorException('Failed to fetch verification record.');
    }
  }

  @Get('user/:id')
  async getUserVerifications(@Param('id') id: string,   @Res() res: Response ) {
    try {
      const result = await this.verificationService.getVerificationByUserId(id);
      if (!result) throw new NotFoundException('Verifications not found.');
      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Verification request fetched successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error fetching verification by ID:', error);
      if (error.status && error.response) {
        throw new BadRequestException(error.response);
      }
      throw new InternalServerErrorException('Failed to fetch verification record.');
    }
  }
}
