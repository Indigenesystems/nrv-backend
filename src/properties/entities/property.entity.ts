import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Room } from 'src/rooms/entities/room.entity';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class Property {
  @Prop()
  @ApiProperty()
  streetAddress: string;

  @Prop()
  @ApiProperty()
  city: string;

  @Prop()
  @ApiProperty()
  state: string;

  @Prop()
  @ApiProperty()
  zipCode: string;

  @Prop()
  @ApiProperty()
  file: string;

  @Prop()
  @ApiProperty()
  landlordInsurancePolicy: string[];

  @Prop()
  @ApiProperty()
  utilityAndMaintenance: string[];

  @Prop()
  @ApiProperty()
  otherDocuments: string[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  createdBy: User;

  // Optional fields
  @Prop({ required: false })
  @ApiProperty()
  preferredTenants: string[]; // Optional array of strings

  @Prop({ required: false })
  @ApiProperty()
  propertyName: string; // Optional string

  // Explicitly define the object type for propertyType
  @Prop({
    type: Object,
    required: false,
  })
  @ApiProperty()
  propertyType: {
    value: string;
    label: string;
  };

  // Explicitly define the object type for rentCollection
  @Prop({
    type: Object,
    required: false,
  })
  @ApiProperty()
  rentCollection: {
    value: string;
    label: string;
  };

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Room' }] })
  @ApiProperty()
  rooms: Room[];
}

export type PropertyDocument = Property & Document;

export const PropertySchema = SchemaFactory.createForClass(Property);
