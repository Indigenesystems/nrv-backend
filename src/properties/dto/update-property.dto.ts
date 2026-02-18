import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  Length,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { UploadedFile } from '@nestjs/common';
import { Express } from 'express';


export class UpdatePropertyDto {
  @IsString()
  streetAddress?: string;

  @IsString()
  city?: string;

  @IsString()
  state?: string;

  @IsString()
  zipCode?: string;

  @IsString()
  createdBy: string;

  // Optional structured fields
  rentCollection?: any;
  propertyType?: any;
  propertyName?: string;

  // File fields are handled by Multer/interceptor, not class-validator
  file?: Express.Multer.File;
  landlordInsurancePolicy?: Express.Multer.File;
  utilityAndMaintenance?: Express.Multer.File;
  otherDocuments?: Express.Multer.File;
}
