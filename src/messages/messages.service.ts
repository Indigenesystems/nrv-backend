import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../messages/entities/message.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  // Add a new message
  async createMessage(createMessageDto: any): Promise<Message | any> {
    let fileUrls: any = null;

    if (createMessageDto.file) {
      fileUrls = await Promise.all(
        createMessageDto.file.map(
          async (file: Express.Multer.File) => {
            return await this.cloudinaryService.upload(file);
          },
        ),
      );

    }
    const newMessage = new this.messageModel({ sender: createMessageDto.sender, recipient: createMessageDto.recipient, content: createMessageDto.content , files: fileUrls});
    return await newMessage.save(); // Save the message to MongoDB
  }

  // Get all messages
  async getAllMessages(): Promise<Message[]> {
    return this.messageModel.find().exec(); // Retrieve all messages
  }

  // Get messages for a specific recipient
  async getMessagesForRecipient(recipient: string): Promise<Message[]> {
    return this.messageModel.find({ recipient }).exec();
  }

  // Get conversation between sender and recipient
  async getConversation(sender: string, recipient: string): Promise<Message[]> {
    return this.messageModel
      .find({
        $or: [
          { sender, recipient },
          { sender: recipient, recipient: sender },
        ],
      })
      .sort({ createdAt: 1 }) // Sort by creation date in ascending order
      .populate('sender') // Populate the sender field with user data
      .populate('recipient') // Populate the recipient field with user data
      .exec();
  }
  
}
