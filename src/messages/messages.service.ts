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
    const attachedFiles: Express.Multer.File[] = Array.isArray(
      createMessageDto.file,
    )
      ? createMessageDto.file
      : [];
    const content = String(createMessageDto.content || '').trim();

    if (!content && attachedFiles.length === 0) {
      throw new Error('Message must include text or at least one image.');
    }

    let fileUrls: string[] = [];
    if (attachedFiles.length > 0) {
      fileUrls = await Promise.all(
        attachedFiles.map(async (file: Express.Multer.File) => {
          return await this.cloudinaryService.upload(file);
        }),
      );
    }

    const newMessage = new this.messageModel({
      sender: createMessageDto.sender,
      recipient: createMessageDto.recipient,
      content,
      files: fileUrls,
    });

    const response = await newMessage.save();

    // Populate sender and recipient details
    const populatedResponse = await this.messageModel
      .findById(response._id)
      .populate('sender', 'firstName lastName email accountType')
      .populate('recipient', 'firstName lastName email accountType');

    const previewBody =
      content ||
      (fileUrls.length > 1
        ? `Sent ${fileUrls.length} photos`
        : 'Sent a photo');

    void this.emailService
      .sendMessageNotification({
        recipientName: populatedResponse.recipient['firstName'],
        senderName: populatedResponse.sender['firstName'],
        recipientEmail: populatedResponse.recipient['email'],
        messageContent: previewBody,
      })
      .catch((emailErr: unknown) => {
        console.error(
          'Message notification email failed:',
          (emailErr as Error)?.message || emailErr,
        );
      });

    const recipient: any = populatedResponse.recipient;
    const senderId = String((populatedResponse.sender as any)?._id || '');
    if (recipient?._id) {
      const accountType = recipient.accountType === 'tenant' ? 'tenant' : 'landlord';
      const actionUrl =
        accountType === 'tenant'
          ? '/dashboard/tenant/messages'
          : senderId
            ? `/dashboard/landlord/messages/${senderId}`
            : '/dashboard/landlord/messages';
      void this.notificationsService
        .create({
          targetRole: accountType,
          userId: String(recipient._id),
          type: 'message_received',
          title: `New message from ${populatedResponse.sender['firstName'] || 'someone'}`,
          body: previewBody.slice(0, 140),
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
      .sort({ createdAt: 1 })
      .populate('sender')
      .populate('recipient')
      .exec();
  }

  async getConversationPartners(userId: string): Promise<
    Array<{
      partnerId: string;
      partner: any;
      lastMessage: string;
      lastMessageAt: Date;
    }>
  > {
    const messages = await this.messageModel
      .find({
        $or: [{ sender: userId }, { recipient: userId }],
      })
      .sort({ createdAt: -1 })
      .populate('sender', 'firstName lastName email accountType')
      .populate('recipient', 'firstName lastName email accountType')
      .exec();

    const partners = new Map<
      string,
      {
        partnerId: string;
        partner: any;
        lastMessage: string;
        lastMessageAt: Date;
      }
    >();

    for (const message of messages) {
      const sender: any = message.sender;
      const recipient: any = message.recipient;
      const senderId = String(sender?._id || sender || '');
      const recipientId = String(recipient?._id || recipient || '');
      const partnerId =
        senderId === String(userId) ? recipientId : senderId;
      const partner = senderId === String(userId) ? recipient : sender;
      if (!partnerId || partnerId === String(userId) || partners.has(partnerId)) {
        continue;
      }
      const files = Array.isArray((message as any).files)
        ? (message as any).files
        : [];
      const text = String(message.content || '').trim();
      const lastMessage =
        text ||
        (files.length > 1
          ? `Sent ${files.length} photos`
          : files.length === 1
            ? 'Sent a photo'
            : '');
      partners.set(partnerId, {
        partnerId,
        partner,
        lastMessage,
        lastMessageAt: (message as any).createdAt,
      });
    }

    return Array.from(partners.values());
  }
}
