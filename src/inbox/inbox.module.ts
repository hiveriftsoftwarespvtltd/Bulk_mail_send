import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { InboxController } from './inbox.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailLog, EmailLogSchema } from '../logs/schemas/email-log.schema';
import { SmtpSender, SmtpSenderSchema } from '../smtp-sender/entities/smtp-sender.entity';
import { GoogleMail, GoogleMailSchema } from '../google-mail/entities/google-mail.entity';
import { OutlookMail, OutlookMailSchema } from '../outlook-mail/entities/outlook-mail.entity';
import { OutlookMailModule } from '../outlook-mail/outlook-mail.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailLog.name, schema: EmailLogSchema },
      { name: SmtpSender.name, schema: SmtpSenderSchema },
      { name: GoogleMail.name, schema: GoogleMailSchema },
      { name: OutlookMail.name, schema: OutlookMailSchema },
    ]),
    LogsModule,
    OutlookMailModule,
  ],
  providers: [InboxService],
  controllers: [InboxController],
})
export class InboxModule {}
