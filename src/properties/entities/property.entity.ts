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
  createdBy: User;

  // Optional fields
  @Prop({ required: false })
  preferredTenants: string[]; // Optional array of strings

  @Prop({ required: false })
  propertyName: string; // Optional string

  // Explicitly define the object type for propertyType
  @Prop({
    type: Object,
    required: false,
  })
  propertyType: {
    value: string;
    label: string;
  };

  // Explicitly define the object type for rentCollection
  @Prop({
    type: Object,
    required: false,
  })
  rentCollection: {
    value: string;
    label: string;
  };
}

export type PropertyDocument = Property & Document;

export const PropertySchema = SchemaFactory.createForClass(Property);
