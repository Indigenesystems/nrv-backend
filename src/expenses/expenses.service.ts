import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Room } from 'src/rooms/entities/room.entity';
import { Model } from 'mongoose';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { Expense } from './entities/expense.entity';


@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createExpense(createExpenseDTO: any) {
    let fileUrl = null;
    if (!createExpenseDTO?.files) {
      fileUrl = await this.cloudinaryService.upload(
        createExpenseDTO.files.file[0],
      );
    }

    const { category, description, roomId, amount, loggedBy } =
      createExpenseDTO.createExpenseDTO;

    const finalPayload = {
      category,
      description,
      roomId,
      loggedBy,
      amount,
      file: fileUrl,
    };

    try {
      const newExpense = await this.expenseModel.create(finalPayload);
      return newExpense;
    } catch (error) {
      throw new Error(`Failed to create expense record: ${error.message}`);
    }
  }

  async findAll() {
    return await this.expenseModel.find().populate('roomId');
  }

  async findOne(id: string) {
    const expense = await this.expenseModel.findById(id).populate('roomId');
    if (!expense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }
    return expense;
  }

  async findByRoomId(roomId: string) {
    const expenses = await this.expenseModel
      .find({ roomId: roomId })
      .populate('roomId');
    return expenses;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto) {
    const updatedExpense = await this.expenseModel
      .findByIdAndUpdate(id, updateExpenseDto, { new: true })
      .populate('roomId');
    if (!updatedExpense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }
    return updatedExpense;
  }

  async remove(id: string) {
    const deletedExpense = await this.expenseModel.findByIdAndDelete(id);
    if (!deletedExpense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }
    return { message: 'Expense successfully deleted' };
  }
}
