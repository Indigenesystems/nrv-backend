// cloudinary.service.ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';


@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: 'dyb8cgrxm',
      api_key: '877684736659451',
      api_secret: '3SzdXJVgfQx_22sC2WeOBvJg0u4',
    });
  }

  async upload(file: Express.Multer.File): Promise<string | any> {
    console.log({ file });

    if (!file) {
      throw new Error('File is required for upload');
    }

    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null); // Signal the end of the stream

    // Upload the stream to Cloudinary
    const result: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto' },
        (error, result) => {
          if (error) {
            return reject(new Error('Upload failed: ' + error.message));
          }
          resolve(result);
        },
      );

      stream.pipe(uploadStream); // Pipe the stream to Cloudinary
    });

    return result.secure_url; // Return the URL of the uploaded image
  }
}
