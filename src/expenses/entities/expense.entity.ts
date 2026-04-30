import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';


@Schema({ timestamps: true })
export class Expense {
  @Prop()
  
  category: string;

  @Prop()
  
  amount: number;

  @Prop()
  
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Room', validate: /^[0-9a-fA-F]{24}$/ })
  
  roomId: Room;

  @Prop({ type: Types.ObjectId, ref: 'User', validate: /^[0-9a-fA-F]{24}$/ })
  
  loggedBy: User;

  @Prop()
  
  file: string;
}

export type ExpenseDocument = Expense & Document;

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
