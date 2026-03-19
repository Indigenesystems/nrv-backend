import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Property } from '../../properties/entities/property.entity';

@Schema({ timestamps: true })
export class Room {
  @Prop({ unique: true })
  roomId: number;

  @Prop()
  name: string;

  @Prop()
  apartmentType: string;

  @Prop()
  description: string;

  @Prop()
  rentAmountMetrics: string;

  @Prop()
  rentAmount: number;

  @Prop()
  file: string;

  @Prop({ type: [String], default: [] })
  imageUrls: string[];

  @Prop()
  noOfRooms: string;

  @Prop()
  noOfBaths: string;

  @Prop()
  noOfPools: string;

  @Prop()
  apartmentStyle: string;

  @Prop()
  leaseTerms: string;

  @Prop()
  paymentOption: string;

  @Prop({ type: [] })
  otherAmentities: string[];

  @Prop({ default: false })
  listRoom: boolean;

  @Prop({ default: false })
  assignedToTenant: boolean;

  // Admin-controlled: becomes true only when admin approves the landlord's listing request
  @Prop({ default: false })
  approved: boolean;

  // Landlord-controlled: becomes true when landlord requests approval for public listing
  @Prop({ default: false })
  approvalRequested: boolean;

  @Prop({ default: null })
  approvalRequestedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId: Property;
}

export type RoomDocument = Room & Document;

export const RoomSchema = SchemaFactory.createForClass(Room);
