import { IsString, IsEmail, IsNotEmpty, IsNumberString, Length, IsEnum, IsBoolean } from 'class-validator';
import { UploadedFile } from '@nestjs/common';
import { Express } from 'express';

export class CreatePropertyDto {
    @IsString()
    @IsNotEmpty()
    streetAddress: string;

    @IsString()
    @IsNotEmpty()
    unit: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    state: string;

    @IsString()
    @IsNotEmpty()
    zipCode: string;

    @IsString()
    @IsNotEmpty()
    createdBy: string;

    // Add this property for file input
    file: Express.Multer.File;
}



