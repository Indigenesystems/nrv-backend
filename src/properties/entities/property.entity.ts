import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';

@Schema()
export class Property {
  @Prop()
  streetAddress: string;

  @Prop()
  unit: string;

  @Prop()
  city: string;

  @Prop()
  state: string;

  @Prop()
  zipCode: string;

  @Prop()
  file: string;

  // Add user reference as a foreign key
  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: User; // Assuming you have a User schema

}

export type PropertyDocument = Property & Document;

export const PropertySchema = SchemaFactory.createForClass(Property);
