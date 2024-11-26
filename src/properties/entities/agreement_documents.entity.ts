import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';
import { Property } from './property.entity';
import { Room } from '../../rooms/entities/room.entity';

@Schema({ timestamps: true })


export class AgreementDocuments {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  propertyId: Room; 
  
  @Prop({ type: Types.ObjectId, ref: 'User' })
  ownerId: User; 

  @Prop({ type: Types.ObjectId, ref: 'User' })
  applicant: User; 

  @Prop({ default: 'Unsigned' })
  status: string;

  @Prop()
  unsignedDocument: string;

  @Prop({default: null})
  signedDocument?: string;
}


export type AgreementDocumentsDocument = AgreementDocuments & Document;

export const AgreementDocumentsSchema = SchemaFactory.createForClass(AgreementDocuments);
