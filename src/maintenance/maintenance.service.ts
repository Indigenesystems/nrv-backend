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
// maintenance.service.ts
async findAllByOwnerId(ownerId: string, page = 1, limit = 10) {
  try {
    const allRecords = await this.maintenanceModel
      .find()
      .populate({
        path: 'roomId',
        populate: {
          path: 'propertyId',
        },
      })
      .populate('createdBy')
      .sort({ createdAt: -1 })
      .exec();

    // Filter by landlord
    const filtered = allRecords.filter((record) => {
      const property: any = record.roomId?.propertyId;
      if (!property || !property.createdBy) return false;
      if (property && property?.createdBy) {
        if (property.createdBy instanceof mongoose.Types.ObjectId) {
          return property.createdBy.equals(ownerId);
        } else {
          return property.createdBy === ownerId;
        }
      }
    });

    // Summary calculation
    const summary = {
      openTickets: 0,
      completed: 0,
      inProgress: 0,
      emergency: 0,
    };

    filtered.forEach((item) => {
      const status = item.status?.toLowerCase();
      if (status === 'completed') summary.completed += 1;
      else if (status === 'in progress') summary.inProgress += 1;
      else if (status === 'emergency') summary.emergency += 1;
      else summary.openTickets += 1;
    });

    // Pagination logic
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedItems = filtered.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedItems,
      summary,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch records: ${error.message}`);
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
