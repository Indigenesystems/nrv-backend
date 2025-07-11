import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UnitDocument, UnitDocumentSchema } from './entities/document.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';


@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, CloudinaryService],
  imports: [
    MongooseModule.forFeature([
      { name: UnitDocument.name, schema: UnitDocumentSchema },
    ]),
  ],
})
export class DocumentsModule {}
