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

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  streetAddress: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  city: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  state: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  file: Express.Multer.File;

  @ApiProperty()
  landlordInsurancePolicy: Express.Multer.File;

  @ApiProperty()
  utilityAndMaintenance: Express.Multer.File;

  @ApiProperty()
  otherDocuments: Express.Multer.File;
}
