import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';

@Schema({ timestamps: true })
export class Application {
  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId: Property; 
  
  @Prop({ type: Types.ObjectId, ref: 'User' })
  ownerId: Property; 

  @Prop({ type: Types.ObjectId, ref: 'User' })
  applicant: User; 

  @Prop({default: 'New'})
  status: string;
}

export type ApplicationDocument = Application & Document;

export const ApplicationSchema = SchemaFactory.createForClass(Application);
