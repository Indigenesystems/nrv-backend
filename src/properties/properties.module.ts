import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { CloudinaryService } from '../upload/cloudinary.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './entities/property.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }]),  // Register UserSchema
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, CloudinaryService],
})
export class PropertiesModule {}
