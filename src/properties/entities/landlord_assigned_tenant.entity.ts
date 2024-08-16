import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Schema({ timestamps: true })


export class LandlordAssignedTenant {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  propertyId: Room; 
  
  @Prop({ type: Types.ObjectId, ref: 'User' })
  ownerId: User; 

  @Prop({ type: Types.ObjectId, ref: 'User' })
  applicant: User; 

  @Prop({ default: 'New' })
  status: string;

  @Prop({ default: null })
  rentStartDate: Date;

  @Prop({ default: null })
  rentEndDate: Date;
}


export type LandlordAssignedTenantDocument = LandlordAssignedTenant & Document;

export const LandlordAssignedTenantSchema = SchemaFactory.createForClass(LandlordAssignedTenant);
