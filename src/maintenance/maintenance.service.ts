import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import { CreateMaintenanceDTO } from './dto/create-maintenance.dto';
import { Maintenance } from './entities/maintenance.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(Maintenance.name) private readonly maintenanceModel: Model<Maintenance>,
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
      return await this.maintenanceModel.find({createdBy, roomId}).populate("roomId").exec();
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Maintenance | null> {
    try {
      return await this.maintenanceModel.findById(id).exec();
    } catch (error) {
      throw new NotFoundException(`Maintenance with ID ${id} not found.`);
    }
  }

  async update(id: string, updateMaintenanceDto: any): Promise<Maintenance | null> {
    try {
      const fileUrl = await this.cloudinaryService.upload(updateMaintenanceDto.file[0]);
      const updatedMaintenance = await this.maintenanceModel.findByIdAndUpdate(id, {
        title: updateMaintenanceDto.title,
        description: updateMaintenanceDto.description,
        roomId: updateMaintenanceDto.roomId,
        file: fileUrl,
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
}
