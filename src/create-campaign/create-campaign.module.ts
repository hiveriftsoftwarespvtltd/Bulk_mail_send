import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from '../mail/mail.module';
import { CreateCampaign, CreateCampaignSchema } from './entities/create-campaign.entity';
import { ScheduleCampaign, ScheduleCampaignSchema } from '../schedule-campaign/entities/schedule-campaign.entity';
import { CreateCampaignController } from './create-campaign.controller';
import { CreateCampaignService } from './create-campaign.service';
import { SmtpSender, SmtpSenderSchema } from '../smtp-sender/entities/smtp-sender.entity';
import { EmailLog, EmailLogSchema } from '../logs/schemas/email-log.schema';
import { BullModule } from '@nestjs/bull';
import { CampaignProcessor } from './processors/campaign.processor';
import { GoogleMail, GoogleMailSchema } from '../google-mail/entities/google-mail.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreateCampaign.name, schema: CreateCampaignSchema },
      { name: SmtpSender.name, schema: SmtpSenderSchema },
      { name: EmailLog.name, schema: EmailLogSchema },
      { name: ScheduleCampaign.name, schema: ScheduleCampaignSchema },
      { name: GoogleMail.name, schema: GoogleMailSchema }
    ]),
    MailModule,
    BullModule.registerQueue({
      name: 'campaign',
    }),
  ],
  controllers: [CreateCampaignController],
  providers: [CreateCampaignService, CampaignProcessor],
})
export class CreateCampaignModule { }