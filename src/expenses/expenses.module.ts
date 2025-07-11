import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from './entities/expense.entity';
import { Room, RoomSchema } from 'src/rooms/entities/room.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Expense.name, schema: ExpenseSchema },
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, CloudinaryService],
})
export class ExpensesModule {}
