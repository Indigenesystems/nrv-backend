import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Room } from 'src/rooms/entities/room.entity';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class UnitDocument {
  @Prop({ type: Types.ObjectId, ref: 'Room' })
  @ApiProperty()
  unitId: Room;

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
}

export type UnitDocumentDocument = UnitDocument & Document;

export const UnitDocumentSchema = SchemaFactory.createForClass(UnitDocument);
