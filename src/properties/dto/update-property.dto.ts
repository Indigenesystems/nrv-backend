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
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePropertyDto {
  @IsString()
  @ApiProperty()
  streetAddress?: string;

  @IsString()
  @ApiProperty()
  city?: string;

  @IsString()
  @ApiProperty()
  state?: string;

  @IsString()
  @ApiProperty()
  zipCode?: string;

  @IsString()
  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  file?: Express.Multer.File;

  @ApiProperty()
  landlordInsurancePolicy?: Express.Multer.File;

  @ApiProperty()
  utilityAndMaintenance?: Express.Multer.File;

  @ApiProperty()
  otherDocuments?: Express.Multer.File;
}
