import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';

@Schema({ timestamps: true })


export class Application {
  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId: Property; 
  
  @Prop({ type: Types.ObjectId, ref: 'User' })
  ownerId: User; 

  @Prop({ type: Types.ObjectId, ref: 'User' })
  applicant: User; 

  @Prop({ default: 'New' })
  status: string;

  @Prop()
  identificationCard: string;

  @Prop()
  currentEmployer: string;

  @Prop()
  jobTitle: string;

  @Prop()
  monthlyIncome: number;

  @Prop()
  jobStartDate: Date;

  @Prop()
  currentLandlord: string;

  @Prop()
  currentAddress: string;

  @Prop()
  reasonForLeaving: string;

  @Prop()
  leaseStartDate: Date;

  @Prop()
  leaseEndDate: Date;

  @Prop({ default: false })
  criminalRecord: boolean;

  @Prop()
  criminalRecordDetails: string;

  @Prop()
  referenceName: string;

  @Prop()
  referenceNumber: string;

  @Prop()
  numberOfVehicles: number;

  @Prop()
  petNumber: number;

  @Prop()
  smoker: boolean;

  @Prop()
  evictionHistory: boolean;

  @Prop()
  evictionDetails: string;
}


export type ApplicationDocument = Application & Document;

export const ApplicationSchema = SchemaFactory.createForClass(Application);
