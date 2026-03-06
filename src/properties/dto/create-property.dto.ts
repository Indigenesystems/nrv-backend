import {
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { UploadedFile } from '@nestjs/common';
import { Express } from 'express';


export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  
  streetAddress: string;

  @IsString()
  @IsNotEmpty()
  
  city: string;

  @IsString()
  @IsNotEmpty()
  
  state: string;

  @IsString()
  @IsNotEmpty()
  
  createdBy: string;

  
  file: Express.Multer.File;

  
  landlordInsurancePolicy: Express.Multer.File;

  
  utilityAndMaintenance: Express.Multer.File;

  
  otherDocuments: Express.Multer.File;
}
