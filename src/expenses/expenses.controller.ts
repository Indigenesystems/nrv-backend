import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFiles,
  BadRequestException,
  UseInterceptors,
  Req,
  HttpStatus,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { createExpenseSchema } from 'src/validations/validator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiProperty } from '@nestjs/swagger';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('/create')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  async createExpense(
    @Body() expenseData: any,
    @UploadedFiles() files: { file?: Express.Multer.File[] },
    @Req() req: Request,
  ) {
    try {
      const validationResult = createExpenseSchema.validate(expenseData);
      console.log({ validationResult });

      if (validationResult.error) {
        throw new BadRequestException(validationResult.error.message);
      }

      const createdExpense = await this.expensesService.createExpense({
        createExpenseDTO: validationResult.value,
        files,
        //  loggedBy: req.user.id, // Assuming you have user information in req.user
      });

      return {
        status: 'success',
        message: 'Expense created successfully',
        data: createdExpense,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll() {
    const expenses = await this.expensesService.findAll();
    return {
      status: 'success',
      message: 'Expenses retrieved successfully',
      data: expenses,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const expense = await this.expensesService.findOne(id);
    return {
      status: 'success',
      message: 'Expense retrieved successfully',
      data: expense,
    };
  }

  @Get('room/:roomId') // Endpoint to find expenses by roomId
  async findByRoomId(@Param('roomId') roomId: string) {
    const expenses = await this.expensesService.findByRoomId(roomId);
    return {
      status: 'success',
      message: 'Expenses retrieved successfully',
      data: expenses,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    const updatedExpense = await this.expensesService.update(
      id,
      updateExpenseDto,
    );
    return {
      status: 'success',
      message: 'Expense updated successfully',
      data: updatedExpense,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.expensesService.remove(id);
    return {
      status: 'success',
      message: 'Expense successfully deleted',
    };
  }
}
