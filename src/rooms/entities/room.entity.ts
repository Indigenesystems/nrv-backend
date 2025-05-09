import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Property } from '../../properties/entities/property.entity';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class Room {
  @Prop({ unique: true })
  @ApiProperty()
  roomId: number;

  @Prop()
  @ApiProperty()
  name: string;

  @Prop()
  @ApiProperty()
  apartmentType: string;

  @Prop()
  @ApiProperty()
  description: string;

  @Prop()
  @ApiProperty()
  rentAmountMetrics: string;

  @Prop()
  @ApiProperty()
  rentAmount: number;

  @Prop()
  @ApiProperty()
  file: string;

  @Prop()
  @ApiProperty()
  noOfRooms: string;

  @Prop()
  @ApiProperty()
  noOfBaths: string;

  @Prop()
  @ApiProperty()
  noOfPools: string;

  @Prop()
  @ApiProperty()
  apartmentStyle: string;

  @Prop()
  @ApiProperty()
  leaseTerms: string;

  @Prop()
  @ApiProperty()
  paymentOption: string;

  @Prop({ type: [] })
  @ApiProperty()
  otherAmentities: string[];

  @Prop({ default: false })
  @ApiProperty()
  listRoom: boolean;

  @Prop({ default: false })
  @ApiProperty()
  assignedToTenant: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  @ApiProperty()
  propertyId: Property;
}

export type RoomDocument = Room & Document;

export const RoomSchema = SchemaFactory.createForClass(Room);
