import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from './application.entity';

@Schema({ timestamps: true })
export class LandlordAssignedTenant {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  @ApiProperty()
  propertyId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  ownerId: User;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  applicant: User;

  @Prop({ enum: ApplicationStatus, default: ApplicationStatus.NEW })
  @ApiProperty({ enum: ApplicationStatus, default: ApplicationStatus.NEW })
  status: ApplicationStatus;

  @Prop({ default: null })
  @ApiProperty()
  rentStartDate: Date;

  @Prop({ default: null })
  @ApiProperty()
  rentEndDate: Date;
}

export type LandlordAssignedTenantDocument = LandlordAssignedTenant & Document;

export const LandlordAssignedTenantSchema = SchemaFactory.createForClass(
  LandlordAssignedTenant,
);
