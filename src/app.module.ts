import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from './mail/mail.module';
import { TrackingModule } from './tracking/tracking.module';
import { LogsModule } from './logs/logs.module';

import { CampaignModule } from './campaign/campaign.module';
import { AuthModule } from './auth/auth.module';
import { CreateCampaignModule } from './create-campaign/create-campaign.module';
import { ScheduleCampaignModule } from './schedule-campaign/schedule-campaign.module';
import { CampaignSettingsModule } from './campaign-settings/campaign-settings.module';
import { SmtpSenderModule } from './smtp-sender/smtp-sender.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { BullModule } from '@nestjs/bull';
import { GoogleMailModule } from './google-mail/google-mail.module';
import { TrackingDomainModule } from './tracking-domain/tracking-domain.module';
import { InboxModule } from './inbox/inbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MailModule,
    TrackingModule,
    LogsModule,
    CampaignModule,
    AuthModule,
    CreateCampaignModule,
    ScheduleCampaignModule,
    CampaignSettingsModule,
    SmtpSenderModule,
    DashboardModule,
    AuditLogModule,
    GoogleMailModule,
    TrackingDomainModule,
    InboxModule,
  ],
})
export class AppModule {}
