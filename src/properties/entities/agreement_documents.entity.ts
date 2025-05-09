import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';
import { Room } from '../../rooms/entities/room.entity';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class AgreementDocuments {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  @ApiProperty()
  propertyId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  ownerId: User;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  @ApiProperty()
  applicant: User;

  @Prop({ default: 'Unsigned' })
  @ApiProperty()
  status: string;

  @Prop()
  @ApiProperty()
  unsignedDocument: string;

  @Prop({ default: null })
  @ApiProperty()
  signedDocument?: string;
}

export type AgreementDocumentsDocument = AgreementDocuments & Document;

export const AgreementDocumentsSchema =
  SchemaFactory.createForClass(AgreementDocuments);
