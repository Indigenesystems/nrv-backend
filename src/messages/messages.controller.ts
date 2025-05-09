import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { MessagingService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetConversationDto } from './dto/get-conversation.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiProperty } from '@nestjs/swagger';

@Controller('messages')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  // Endpoint to send a message
  @Post('send')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 5 }]))
  async sendMessage(
    @Body() createMessageDto: CreateMessageDto,
    @UploadedFiles()
    files: {
      file?: Express.Multer.File;
    },
    @Res() res: Response,
  ) {
    const finalPayload = { ...createMessageDto, ...files };
    try {
      const createdMessage =
        await this.messagingService.createMessage(finalPayload);
      return res.status(HttpStatus.CREATED).json({
        status: 'success',
        message: 'message sent successfully',
        data: createdMessage,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  // Endpoint to get all messages
  @Get()
  getAllMessages() {
    return this.messagingService.getAllMessages();
  }

  // Endpoint to get messages for a specific recipient
  @Get('recipient/:recipient')
  getMessagesForRecipient(@Param('recipient') recipient: string) {
    return this.messagingService.getMessagesForRecipient(recipient);
  }

  // Endpoint to get conversation between sender and recipient
  @Get('conversation/:sender/:recipient')
  async getConversation(
    @Param() params: GetConversationDto,
    @Res() res: Response,
  ) {
    const { sender, recipient } = params;
    try {
      const conversation = await this.messagingService.getConversation(
        sender,
        recipient,
      );
      return res.status(HttpStatus.CREATED).json({
        status: 'success',
        message: 'conversation fetched successfully',
        data: conversation,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}
