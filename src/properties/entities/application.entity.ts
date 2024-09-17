import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';
import { Room } from '../../rooms/entities/room.entity';

@Schema({ timestamps: true })


export class Application {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  propertyId: Room; 
  
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
  reasonForLiving: string;

  @Prop()
  monthlyIncome: number;

  @Prop()
  currentResidence: string;

}


export type ApplicationDocument = Application & Document;

export const ApplicationSchema = SchemaFactory.createForClass(Application);
