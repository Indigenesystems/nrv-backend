import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Room } from 'src/rooms/entities/room.entity';

@Schema({ timestamps: true })
export class UnitDocument {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  unitId: Room;

  @Prop()
  file: string;

  @Prop()
  landlordInsurancePolicy: string[];

  @Prop()
  utilityAndMaintenance: string[];

  @Prop()
  otherDocuments: string[];
}

export type UnitDocumentDocument = UnitDocument & Document;

export const UnitDocumentSchema = SchemaFactory.createForClass(UnitDocument);
