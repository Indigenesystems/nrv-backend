import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { CreateMaintenanceDTO } from './dto/create-maintenance.dto';
import { Maintenance } from './entities/maintenance.entity';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(Maintenance.name) private readonly maintenanceModel: Model<Maintenance>,
    @InjectModel(AgreementDocuments.name) private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    private cloudinaryService: CloudinaryService,
  ) { }

  async create(createMaintenanceDto: any): Promise<Maintenance> {
    try {
      const latestMaintenance = await this.maintenanceModel.findOne({}, { maintenanceId: 1 }).sort({ maintenanceId: -1 }).limit(1);
      const maxMaintenanceId = latestMaintenance ? latestMaintenance.maintenanceId : 0;
      const fileUrl = await this.cloudinaryService.upload(createMaintenanceDto.file[0]);
      const maintenanceId = maxMaintenanceId + 1;

      const newMaintenance = new this.maintenanceModel({
        maintenanceId,
        title: createMaintenanceDto.title,
        description: createMaintenanceDto.description,
        roomId: createMaintenanceDto.roomId,
        createdBy: createMaintenanceDto.createdBy,
        file: fileUrl,
      });

      return await newMaintenance.save();
    } catch (error) {
      throw new Error(`Failed to log maintenance: ${error.message}`);
    }
  }
  
  async findAll(createdBy: any, roomId: any): Promise<Maintenance[]> {
    try {
      return await this.maintenanceModel.find({createdBy, roomId}).populate("roomId").sort({createdAt: -1}).exec();
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }

  async findAllByOwnerId(ownerId: any): Promise<Maintenance[]> {
    try {
      const maintenanceRecords = await this.maintenanceModel.find()
      .populate({
        path: 'roomId',  // Populate the roomId field
        populate: {
          path: 'propertyId', // Nested population to populate the propertyId field within roomId
        }
      })
      .populate('createdBy')  // Populate the createdBy field directly
      .sort({ createdAt: -1 })
      .exec();
    
      const filteredRecords = maintenanceRecords.filter(record => {
        const propertyId = record.roomId?.propertyId;
        if (propertyId && propertyId?.createdBy) {
          if (propertyId?.createdBy instanceof mongoose.Types.ObjectId) {
            return propertyId?.createdBy.equals(ownerId);
          } else {
            return propertyId?.createdBy === ownerId;
          }
        }
        return false;
      });
  
      return filteredRecords;
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }
  
  async findOne(id: string): Promise<Maintenance | null> {
    try {
      return await this.maintenanceModel.findById(id).populate("roomId").populate('createdBy').exec();
    } catch (error) {
      throw new NotFoundException(`Maintenance with ID ${id} not found.`);
    }
  }

  async updateMaintenanceStatus(id: string, status: string): Promise<Maintenance | null> {
    try {
      const updatedMaintenance = await this.maintenanceModel.findByIdAndUpdate(id, {
        status: status
      }, { new: true });

      return updatedMaintenance;
    } catch (error) {
      throw new Error(`Failed to update maintenance with ID ${id}: ${error.message}`);
    }
  }

  async remove(id: string): Promise<Maintenance | null> {
    try {
      return await this.maintenanceModel.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Failed to delete maintenance with ID ${id}: ${error.message}`);
    }
  }

  async findAllMaintenanceByTenantId(id: any): Promise<Maintenance[]> {
    try {

      const maintenanceRecords = await this.maintenanceModel.find({createdBy: id})
        .populate({
          path: 'roomId',
          populate: { path: 'propertyId' }
        }).sort({ createdAt: -1 }).exec();


      return maintenanceRecords;
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }
}
