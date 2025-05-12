import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const corsOptions: CorsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://nrv-frontend.vercel.app',
    'https://nrv-frontend.onrender.com',
    'https://nrv-frontend-main.vercel.app',
    'https://www.naijarentverify.com'
  ], // Allow requests from these origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true, // Allow cookies and credentials
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with the specified options
  app.enableCors(corsOptions);

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('The API description')
    .setVersion('1.0')
    .addTag('api') // Tag to categorize routes in Swagger UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Set Swagger UI route to '/api'

  // Start the application on port 9000
  await app.listen(9000);
}

bootstrap();
