import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { ApiProperty } from '@nestjs/swagger';

// Step 1: Define the enum
export enum ApplicationStatus {
  NEW = 'New',
  ACCEPTED = 'Accepted',
  ACTIVE_LEASE = 'Active_lease',
  EXPIRED = 'Expired',
  ENDED = 'Ended',
}

@Schema({ timestamps: true })
export class Application {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  @ApiProperty()
  propertyId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  ownerId: User;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  applicant: User;

  // Step 2: Use the enum in the status field
  @Prop({ enum: ApplicationStatus, default: ApplicationStatus.NEW })
  @ApiProperty({ enum: ApplicationStatus, default: ApplicationStatus.NEW })
  status: ApplicationStatus;

  @Prop()
  @ApiProperty()
  identificationCard: string;

  @Prop()
  @ApiProperty()
  currentEmployer: string;

  @Prop()
  @ApiProperty()
  reasonForLiving: string;

  @Prop()
  @ApiProperty()
  monthlyIncome: number;

  @Prop()
  @ApiProperty()
  currentResidence: string;

  @Prop()
  @ApiProperty()
  jobTitle: string;

  @Prop({ default: null })
  @ApiProperty()
  rentEndDate: Date;

  @Prop({ default: null })
  @ApiProperty()
  rentStartDate: Date;
}

export type ApplicationDocument = Application & Document;
export const ApplicationSchema = SchemaFactory.createForClass(Application);
