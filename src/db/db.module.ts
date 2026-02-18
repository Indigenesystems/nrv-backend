import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import config from '../config/config';


@Module({
  imports: [MongooseModule.forRoot(getMongoURI(), {})],
})
export class MongodbModule implements OnModuleInit {
  async onModuleInit() {
    try {
      await mongoose.connection;
      console.error('Database connected successfully');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      process.exit(1);
    }
  }
}

function getMongoURI(): string {
  const MONGO_DB_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    config?.web?.mongoDBUri;
  if (!MONGO_DB_URI) {
    throw new Error(
      'MongoDB URI not set. Set MONGO_URI or MONGODB_URI in .env, or mongoDBUri in config.',
    );
  }
  return MONGO_DB_URI;
}
