import {
  Body,
  Controller,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { EmailService } from '../email-sender/email.service';

@Controller('support')
export class SupportController {
  constructor(private readonly emailService: EmailService) {}

  @Post('contact')
  async contactSupport(
    @Body()
    body: {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
      channel?: string;
    },
  ) {
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim();
    const message = String(body?.message || '').trim();
    const subject = String(body?.subject || 'Support request').trim();
    const channel = String(body?.channel || 'email').trim();

    if (!name || !email || !message) {
      throw new BadRequestException('Name, email, and message are required.');
    }

    await this.emailService.sendSupportContactEmail({
      name,
      email,
      subject,
      message,
      channel,
    });

    return {
      status: 'success',
      message: 'Your message has been sent to support.',
    };
  }
}
