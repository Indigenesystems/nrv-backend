import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const corsOptions: CorsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001',  'https://nrv-frontend.vercel.app'], // Allow requests from this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allow specified HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow specified headers
  credentials: true, // Allow sending cookies and credentials
};
async function bootstrap() {

  const app = await NestFactory.create(AppModule);
  app.enableCors(corsOptions);
  await app.listen(9000);
}
bootstrap();

