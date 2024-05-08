// cloudinary.service.ts
import { Injectable } from '@nestjs/common';
import * as cloudinary from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.v2.config({
      cloud_name: 'dyb8cgrxm',
      api_key: '877684736659451',
      api_secret: '3SzdXJVgfQx_22sC2WeOBvJg0u4',
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new Error('File is required for upload');
    }

    const result = await cloudinary.v2.uploader.upload(file.path);
    return result.secure_url;
  }
  
}
