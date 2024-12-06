import { Controller, Post, Body, Get, Param, Put } from '@nestjs/common';
import { MessagingService } from './messages.service';

@Controller('messages')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  // Send a message
  @Post()
  async sendMessage(@Body() createMessageDto: { conversationId: string, senderId: string, recipientId: string, content: string }) {
    return this.messagingService.createMessage(createMessageDto.conversationId, createMessageDto.senderId, createMessageDto.recipientId, createMessageDto.content);
  }

  // Get messages in a conversation
  @Get(':conversationId')
  async getMessages(@Param('conversationId') conversationId: string) {
    return this.messagingService.getMessagesByConversation(conversationId);
  }

  // Mark message as read
  @Put('read/:messageId')
  async markAsRead(@Param('messageId') messageId: string) {
    return this.messagingService.markMessageAsRead(messageId);
  }

  // Get user conversations
  @Get('conversations/:userId')
  async getConversations(@Param('userId') userId: string) {
    return this.messagingService.getConversationsByUser(userId);
  }
}

