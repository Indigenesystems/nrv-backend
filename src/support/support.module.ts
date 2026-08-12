import { Module } from '@nestjs/common';
import { EmailServiceModule } from '../email-sender/email-sender.module';
import { SupportController } from './support.controller';

@Module({
  imports: [EmailServiceModule],
  controllers: [SupportController],
})
export class SupportModule {}
