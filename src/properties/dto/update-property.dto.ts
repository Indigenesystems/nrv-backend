import { IsString, IsEmail, IsNotEmpty, IsNumberString, Length, IsEnum, IsBoolean } from 'class-validator';
import { UploadedFile } from '@nestjs/common';
import { Express } from 'express';

export class UpdatePropertyDto {
    @IsString()
    streetAddress?: string;

    @IsString()
    unit?: string;

    @IsString()
    city?: string;

    @IsString()
    state?: string;

    @IsString()
    zipCode?: string;

    @IsString()
    propertyType?: string;

    @IsString()
    createdBy: string;

    file?: Express.Multer.File;

    landlordInsurancePolicy?: Express.Multer.File;

    utilityAndMaintenance?: Express.Multer.File;

    otherDocuments?: Express.Multer.File;
}
