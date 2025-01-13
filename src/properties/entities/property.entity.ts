import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';

@Schema({ timestamps: true })
export class Property {
  @Prop()
  streetAddress: string;

  @Prop()
  city: string;

  @Prop()
  state: string;

  @Prop()
  zipCode: string;

  @Prop()
  file: string;

  @Prop()
  landlordInsurancePolicy: string[];

  @Prop()
  utilityAndMaintenance: string[];

  @Prop()
  otherDocuments: string[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: User; // Assuming you have a User schema

}

export type PropertyDocument = Property & Document;

export const PropertySchema = SchemaFactory.createForClass(Property);
