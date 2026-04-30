import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { InjectModel } from '@nestjs/mongoose';
import { UnitDocument } from './entities/document.entity';
import { Model } from 'mongoose';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(UnitDocument.name)
    private readonly unitDocumentModel: Model<UnitDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createUnitDocument(createDto: any) {
    console.log({ createDto });

    let landlordInsurancePolicyUrls = null;
    let utilityAndMaintenanceUrls = null;
    let otherDocumentsUrls = null;
    let fileUrl = null;

    if (createDto.file) {
      fileUrl = await this.cloudinaryService.upload(createDto.file[0]);
    }

    if (createDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        createDto.landlordInsurancePolicy.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
    }

    if (createDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        createDto.utilityAndMaintenance.map(async (file: Express.Multer.File) =>
          this.cloudinaryService.upload(file),
        ),
      );
    }

    if (createDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        createDto.otherDocuments.map(async (file: Express.Multer.File) =>
          this.cloudinaryService.upload(file),
        ),
      );
    }

    const unitDocument = new this.unitDocumentModel({
      unitId: createDto.property,
      file: fileUrl,
      landlordInsurancePolicy: landlordInsurancePolicyUrls,
      utilityAndMaintenance: utilityAndMaintenanceUrls,
      otherDocuments: otherDocumentsUrls,
    });

    return unitDocument.save();
  }

  async findAll() {
    return this.unitDocumentModel.find().exec();
  }

  async findOne(id: string) {
    const doc = await this.unitDocumentModel.find({unitId: id}).populate("unitId").exec();
    console.log({doc});
    
    if (!doc) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    return doc[0];
  }

  async update(id: string, updateDto: any) {
    const existingDoc = await this.unitDocumentModel.findById(id).exec();
    if (!existingDoc) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
  
    // Handle re-uploads if any files are passed
    let fileUrl = existingDoc.file;
    let landlordInsurancePolicyUrls = existingDoc.landlordInsurancePolicy;
    let utilityAndMaintenanceUrls = existingDoc.utilityAndMaintenance;
    let otherDocumentsUrls = existingDoc.otherDocuments;
  
    if (updateDto.file) {
      fileUrl = await this.cloudinaryService.upload(updateDto.file[0]);
    }
  
    if (updateDto.landlordInsurancePolicy) {
      landlordInsurancePolicyUrls = await Promise.all(
        updateDto.landlordInsurancePolicy.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
    }
  
    if (updateDto.utilityAndMaintenance) {
      utilityAndMaintenanceUrls = await Promise.all(
        updateDto.utilityAndMaintenance.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
    }
  
    if (updateDto.otherDocuments) {
      otherDocumentsUrls = await Promise.all(
        updateDto.otherDocuments.map(
          async (file: Express.Multer.File) =>
            this.cloudinaryService.upload(file),
        ),
      );
    }
  
    // Update the document
    const updated = await this.unitDocumentModel.findByIdAndUpdate(
      id,
      {
        unitId: updateDto.property || existingDoc.unitId,
        file: fileUrl,
        landlordInsurancePolicy: landlordInsurancePolicyUrls,
        utilityAndMaintenance: utilityAndMaintenanceUrls,
        otherDocuments: otherDocumentsUrls,
      },
      { new: true },
    );
  
    return updated;
  }
  

  async remove(id: string) {
    const deleted = await this.unitDocumentModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    return { message: 'Document deleted successfully' };
  }
}
