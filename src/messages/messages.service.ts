import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../messages/entities/message.entity';
import { CloudinaryService } from 'src/upload/cloudinary.service';
import { EmailService } from 'src/email-sender/email.service';
import { NotificationsService } from 'src/notifications/notifications.service';


@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private cloudinaryService: CloudinaryService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  // Add a new message
  async createMessage(createMessageDto: any): Promise<Message | any> {
    let fileUrls: any = null;

    if (createMessageDto.file) {
      fileUrls = await Promise.all(
        createMessageDto.file.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        }),
      );
    }

    const newMessage = new this.messageModel({
      sender: createMessageDto.sender,
      recipient: createMessageDto.recipient,
      content: createMessageDto.content,
      files: fileUrls,
    });

    const response = await newMessage.save();

    // Populate sender and recipient details
    const populatedResponse = await this.messageModel
      .findById(response._id)
      .populate('sender', 'firstName lastName email accountType')
      .populate('recipient', 'firstName lastName email accountType');

    void this.emailService
      .sendMessageNotification({
        recipientName: populatedResponse.recipient['firstName'],
        senderName: populatedResponse.sender['firstName'],
        recipientEmail: populatedResponse.recipient['email'],
        messageContent: populatedResponse.content,
      })
      .catch((emailErr: unknown) => {
        console.error(
          'Message notification email failed:',
          (emailErr as Error)?.message || emailErr,
        );
      });

    const recipient: any = populatedResponse.recipient;
    if (recipient?._id) {
      const accountType = recipient.accountType === 'tenant' ? 'tenant' : 'landlord';
      const actionUrl =
        accountType === 'tenant'
          ? '/dashboard/tenant/messages'
          : '/dashboard/landlord/messages';
      void this.notificationsService
        .create({
          targetRole: accountType,
          userId: String(recipient._id),
          type: 'message_received',
          title: `New message from ${populatedResponse.sender['firstName'] || 'someone'}`,
          body: String(populatedResponse.content || '').slice(0, 140),
          metadata: {
            messageId: String(populatedResponse._id),
            senderId: String((populatedResponse.sender as any)?._id || ''),
            actionUrl,
          },
        })
        .catch((notifErr: unknown) => {
          console.error(
            'Message in-app notification failed:',
            (notifErr as Error)?.message || notifErr,
          );
        });
    }

    return populatedResponse;
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
