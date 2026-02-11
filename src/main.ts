import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';


const corsOptions: CorsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:8080',
    'https://nrv-frontend.vercel.app',
    'https://nrv-frontend.onrender.com',
    'https://nrv-frontend-main.vercel.app',
    'https://www.naijarentverify.com',
    'https://nrv-admin-fe.vercel.app',
    'https://admin-hub-fv4h.onrender.com'
  ], // Allow requests from these origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true, // Allow cookies and credentials
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(corsOptions);
  await app.listen(9000);
}

bootstrap();
