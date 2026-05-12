import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SmtpSender,
  SmtpSenderSchema,
} from './entities/smtp-sender.entity';
import { SmtpSenderService } from './smtp-sender.service';
import { SmtpSenderController } from './smtp-sender.controller';
import { GoogleMailModule } from '../google-mail/google-mail.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SmtpSender.name, schema: SmtpSenderSchema },
    ]),
    GoogleMailModule,
    MailModule,
  ],
  
  controllers: [SmtpSenderController],
  providers: [SmtpSenderService],
})
export class SmtpSenderModule {}