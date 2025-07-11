import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { IsEnum, IsOptional } from 'class-validator';


export enum MaintenanceStatus {
  NEW = 'New',
  ACKNOWLEDGED = 'Acknowledged',
  IN_PROGRESS = 'In Progress',
  RESOLVED = 'Resolved',
  DECLINED = 'Declined',
}

export enum PriorityLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  EMERGENCY = 'Emergency',
}

@Schema({ timestamps: true })
export class Maintenance {
  @Prop({ unique: true })
  
  maintenanceId: number;

  @Prop()
  
  title: string;

  @Prop()
  
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Room', validate: /^[0-9a-fA-F]{24}$/ })
  
  roomId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User', validate: /^[0-9a-fA-F]{24}$/ })
  
  createdBy: User;

  @Prop({ default: MaintenanceStatus.NEW, enum: MaintenanceStatus })
  @IsEnum(MaintenanceStatus)
  
  status: MaintenanceStatus;

  @Prop({ enum: PriorityLevel, default: PriorityLevel.MEDIUM })
  @IsEnum(PriorityLevel)
  
  priority: PriorityLevel;

  @Prop()
  @IsOptional()
  
  assignedTo?: string;

  @Prop()
  @IsOptional()
  
  assigneePhoneNumber?: string;

  @Prop()
  @IsOptional()
  
  extraNoteToTenant?: string;

  @Prop()
  @IsOptional()
  
  scheduledDate?: Date;

  @Prop()
  
  file?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Property',
    validate: /^[0-9a-fA-F]{24}$/,
  })
  @IsOptional()
  
  propertyId?: Property;
}

export type MaintenanceDocument = Maintenance & Document;
export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);
