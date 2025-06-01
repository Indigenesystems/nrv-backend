import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class Application {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  @ApiProperty()
  propertyId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  ownerId: User;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  applicant: User;

  @Prop({ default: 'New' })
  @ApiProperty()
  status: string;

  @Prop()
  @ApiProperty()
  identificationCard: string;

  @Prop()
  @ApiProperty()
  currentEmployer: string;

  @Prop()
  @ApiProperty()
  reasonForLiving: string;

  @Prop()
  @ApiProperty()
  monthlyIncome: number;

  @Prop()
  @ApiProperty()
  currentResidence: string;

  @Prop()
  @ApiProperty()
  jobTitle: string;


  @Prop({ default: null })
  @ApiProperty()
  rentEndDate: Date;

  @Prop({ default: null })
  @ApiProperty()
  rentStartDate: Date;
}

export type ApplicationDocument = Application & Document;

export const ApplicationSchema = SchemaFactory.createForClass(Application);
