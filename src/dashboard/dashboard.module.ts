import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CreateCampaign, CreateCampaignSchema } from '../create-campaign/entities/create-campaign.entity';
import { EmailLog, EmailLogSchema } from '../logs/schemas/email-log.schema';
import { SmtpSender, SmtpSenderSchema } from '../smtp-sender/entities/smtp-sender.entity';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { GoogleMail, GoogleMailSchema } from '../google-mail/entities/google-mail.entity';
import { OutlookMail, OutlookMailSchema } from '../outlook-mail/entities/outlook-mail.entity';

@Module({
  imports: [
    MongooseModule.forFeature([

      { name: CreateCampaign.name, schema: CreateCampaignSchema },
      { name: EmailLog.name, schema: EmailLogSchema },
      { name: SmtpSender.name, schema: SmtpSenderSchema },
      { name: User.name, schema: UserSchema },
      { name: GoogleMail.name, schema: GoogleMailSchema },
      { name: OutlookMail.name, schema: OutlookMailSchema },
    ]),

  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule { }
