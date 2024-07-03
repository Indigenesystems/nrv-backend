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
    description: string;

    @Prop()
    rentAmountMetrics: string;

    @Prop()
    rentAmount: string;

    @Prop()
    file: string;

    @Prop()
    targetRent: string;

    @Prop()
    targetDeposit: string;

    @Prop()
    noOfRooms: string;

    @Prop()
    noOfBaths: string;

    @Prop()
    noOfPools: string;

    @Prop()
    otherAmentities: string;

    @Prop({ default: false })
    listRoom: boolean;

    @Prop({ type: Types.ObjectId, ref: 'Property', validate: /^[0-9a-fA-F]{24}$/ })
    propertyId: Property;
}

export type RoomDocument = Room & Document;

export const RoomSchema = SchemaFactory.createForClass(Room);


