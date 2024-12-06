import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './entities/message.entity';
import { Conversation, ConversationDocument } from './entities/conversation.entity';

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  // Create a new message
  async createMessage(conversationId: string, senderId: string, recipientId: string, content: string) {
    const message = new this.messageModel({
      conversationId,
      senderId,
      recipientId,
      content,
    });
    return message.save();
  }

  // Get messages by conversation
  async getMessagesByConversation(conversationId: string) {
    return this.messageModel.find({ conversationId }).exec();
  }

  // Mark message as read
  async markMessageAsRead(messageId: string) {
    return this.messageModel.findByIdAndUpdate(messageId, { isRead: true, readAt: new Date() }, { new: true }).exec();
  }

  // Create a new conversation
  async createConversation(participants: string[], title?: string) {
    const conversation = new this.conversationModel({ participants, title });
    return conversation.save();
  }

  // Get conversations for a user
  async getConversationsByUser(userId: string) {
    return this.conversationModel.find({ participants: userId }).exec();
  }
}
