import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';
import { Room } from '../../rooms/entities/room.entity';


// Step 1: Define the enum
export enum ApplicationStatus {
  NEW = 'New',
  ACCEPTED = 'Accepted',
  ACTIVE_LEASE = 'Active_lease',
  EXPIRED = 'Expired',
  ENDED = 'Ended',
  REJECTED="Rejected"
}

@Schema({ timestamps: true })
export class Application {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  
  propertyId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  
  ownerId: User;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  
  applicant: User;

  // Step 2: Use the enum in the status field
  @Prop({ enum: ApplicationStatus, default: ApplicationStatus.NEW })
  
  status: ApplicationStatus;

  @Prop()
  
  identificationCard: string;

  @Prop()
  
  currentEmployer: string;

  @Prop()
  
  reasonForLiving: string;

  @Prop()
  
  monthlyIncome: number;

  @Prop()
  
  currentResidence: string;

  @Prop()
  
  jobTitle: string;

  @Prop({ default: null })
  
  rentEndDate: Date;

  @Prop({ default: null })
  
  rentStartDate: Date;
}

export type ApplicationDocument = Application & Document;
export const ApplicationSchema = SchemaFactory.createForClass(Application);
