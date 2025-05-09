import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty()
  maintenanceId: number;

  @Prop()
  @ApiProperty()
  title: string;

  @Prop()
  @ApiProperty()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Room', validate: /^[0-9a-fA-F]{24}$/ })
  @ApiProperty()
  roomId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User', validate: /^[0-9a-fA-F]{24}$/ })
  @ApiProperty()
  createdBy: User;

  @Prop({ default: MaintenanceStatus.NEW, enum: MaintenanceStatus })
  @IsEnum(MaintenanceStatus)
  @ApiProperty()
  status: MaintenanceStatus;

  @Prop({ enum: PriorityLevel, default: PriorityLevel.MEDIUM })
  @IsEnum(PriorityLevel)
  @ApiProperty()
  priority: PriorityLevel;

  @Prop()
  @IsOptional()
  @ApiProperty()
  assignedTo?: string;

  @Prop()
  @IsOptional()
  @ApiProperty()
  assigneePhoneNumber?: string;

  @Prop()
  @IsOptional()
  @ApiProperty()
  extraNoteToTenant?: string;

  @Prop()
  @IsOptional()
  @ApiProperty()
  scheduledDate?: Date;

  @Prop()
  @ApiProperty()
  file?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Property',
    validate: /^[0-9a-fA-F]{24}$/,
  })
  @IsOptional()
  @ApiProperty()
  propertyId?: Property;
}

export type MaintenanceDocument = Maintenance & Document;
export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);
