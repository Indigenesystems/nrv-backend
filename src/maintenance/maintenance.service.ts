import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { CreateMaintenanceDTO } from './dto/create-maintenance.dto';
import { Maintenance } from './entities/maintenance.entity';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';
import { paginateAndSummarize } from 'src/helper/pagination.helper';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(Maintenance.name)
    private readonly maintenanceModel: Model<Maintenance>,
    @InjectModel(AgreementDocuments.name)
    private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(createMaintenanceDto: any): Promise<Maintenance> {
    try {
      const latestMaintenance = await this.maintenanceModel
        .findOne({}, { maintenanceId: 1 })
        .sort({ maintenanceId: -1 })
        .limit(1);
      const maxMaintenanceId = latestMaintenance
        ? latestMaintenance.maintenanceId
        : 0;
      const fileUrl = await this.cloudinaryService.upload(
        createMaintenanceDto.file[0],
      );
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
  
  async update(id: string, updateMaintenanceDto: any): Promise<Maintenance> {
    try {
      const updateData: any = {};
  
      // Dynamically copy properties from updateMaintenanceDto that are not null/undefined
      Object.keys(updateMaintenanceDto).forEach(key => {
        if (updateMaintenanceDto[key] !== undefined && updateMaintenanceDto[key] !== null) {
          updateData[key] = updateMaintenanceDto[key];
        }
      });
  
      // Handle file upload separately if it's provided
      if (updateMaintenanceDto.file && updateMaintenanceDto.file.length > 0) {
        const fileUrl = await this.cloudinaryService.upload(updateMaintenanceDto.file[0]);
        updateData.file = fileUrl;
      }
  
      // Update the maintenance entry
      const updatedMaintenance = await this.maintenanceModel.findByIdAndUpdate(id, updateData, { new: true });
  
      if (!updatedMaintenance) {
        throw new Error('Maintenance not found');
      }
  
      return updatedMaintenance;
    } catch (error) {
      throw new Error(`Failed to update maintenance: ${error.message}`);
    }
  }
  
  async findAll(createdBy: any, roomId: any): Promise<Maintenance[]> {
    try {
      return await this.maintenanceModel
        .find({ createdBy, roomId })
        .populate('roomId')
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }

  async findAllByOwnerId(
    ownerId: string,
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ) {
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

      const filteredByOwner = allRecords.filter((record) => {
        const property: any = record.roomId?.propertyId;
        if (!property || !property.createdBy) return false;
        if (property.createdBy instanceof mongoose.Types.ObjectId) {
          return property.createdBy.equals(ownerId);
        }
        return property.createdBy === ownerId;
      });

      let filtered = status
        ? filteredByOwner.filter(
            (item) => item.status?.toLowerCase() === status.toLowerCase(),
          )
        : filteredByOwner;

      if (search) {
        const keyword = search.toLowerCase();
        filtered = filtered.filter((item) => {
          const apartmentType = item.roomId?.apartmentType?.toLowerCase() || '';
          const address =
            item.roomId?.propertyId?.streetAddress?.toLowerCase() || '';
          const title = item.title?.toLowerCase() || '';
          const description = item.description?.toLowerCase() || '';
          const maintenanceId = item.maintenanceId?.toString() || '';
          return (
            apartmentType.includes(keyword) ||
            address.includes(keyword) ||
            title.includes(keyword) ||
            description.includes(keyword) ||
            maintenanceId.includes(keyword)
          );
        });
      }
      const summary: Record<string, number> = {};
      // Summarize based on the filtered data
      filteredByOwner.forEach((item) => {
        const status = item.status || 'unknown';
        summary[status] = (summary[status] || 0) + 1;
      });

      return {
        ...paginateAndSummarize(filtered, page, limit, [
          'New',
          'In Progress',
          'Completed',
          'Emergency',
        ]),
        summary,
      };
    } catch (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }
  }

  async findMaintenancePerApartment(
    roomId: string,
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ): Promise<any> {
    try {
      const allRecords = await this.maintenanceModel
        .find({ roomId })
        .populate({
          path: 'roomId',
          populate: {
            path: 'propertyId',
          },
        })
        .sort({ createdAt: -1 })
        .exec();


        let filtered = status
        ? allRecords.filter(
            (item) => item.status?.toLowerCase() === status.toLowerCase(),
          )
        : allRecords;

        if (search) {
          const keyword = search.toLowerCase();
          filtered = allRecords.filter((item) => {
            const apartmentType = item.roomId?.apartmentType?.toLowerCase() || '';
            const address =
              item.roomId?.propertyId?.streetAddress?.toLowerCase() || '';
            const title = item.title?.toLowerCase() || '';
            const maintenanceId =  item.maintenanceId.toString() || '';
            const description = item.description?.toLowerCase() || '';
            return (
              apartmentType.includes(keyword) ||
              address.includes(keyword) ||
              title.includes(keyword) ||
              description.includes(keyword) ||
              maintenanceId.includes(keyword)
            );
          });
        }

      return paginateAndSummarize(filtered, page, limit, [
        'New',
        'In Progress',
        'Completed',
        'Emergency',
      ]);
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Maintenance | null> {
    try {
      return await this.maintenanceModel
        .findById(id)
        .populate({
          path: 'roomId',
          populate: {
            path: 'propertyId',

          }
        })
        .populate('createdBy')
        .exec();
    } catch (error) {
      throw new NotFoundException(`Maintenance with ID ${id} not found.`);
    }
  }

  async updateMaintenanceStatus(
    id: string,
    status: string,
  ): Promise<Maintenance | null> {
    try {
      const updatedMaintenance = await this.maintenanceModel.findByIdAndUpdate(
        id,
        {
          status: status,
        },
        { new: true },
      );

      return updatedMaintenance;
    } catch (error) {
      throw new Error(
        `Failed to update maintenance with ID ${id}: ${error.message}`,
      );
    }
  }

  async remove(id: string): Promise<Maintenance | null> {
    try {
      return await this.maintenanceModel.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(
        `Failed to delete maintenance with ID ${id}: ${error.message}`,
      );
    }
  }

  async findAllMaintenanceByTenantId(id: any): Promise<Maintenance[]> {
    try {
      const maintenanceRecords = await this.maintenanceModel
        .find({ createdBy: id })
        .populate({
          path: 'roomId',
          populate: { path: 'propertyId' },
        })
        .sort({ createdAt: -1 })
        .exec();

      return maintenanceRecords;
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }
}
