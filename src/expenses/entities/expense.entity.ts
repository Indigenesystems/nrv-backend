import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class Expense {
  @Prop()
  @ApiProperty()
  category: string;

  @Prop()
  @ApiProperty()
  amount: number;

  @Prop()
  @ApiProperty()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Room', validate: /^[0-9a-fA-F]{24}$/ })
  @ApiProperty()
  roomId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User', validate: /^[0-9a-fA-F]{24}$/ })
  @ApiProperty()
  loggedBy: User;

  @Prop()
  @ApiProperty()
  file: string;
}

export type ExpenseDocument = Expense & Document;

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
