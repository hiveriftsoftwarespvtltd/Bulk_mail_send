// schedule-campaign.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ScheduleCampaign,
  ScheduleCampaignSchema,
} from './entities/schedule-campaign.entity';
import { ScheduleCampaignService } from './schedule-campaign.service';
import { ScheduleCampaignController } from './schedule-campaign.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduleCampaign.name, schema: ScheduleCampaignSchema },
    ]),
  ],
  controllers: [ScheduleCampaignController],
  providers: [ScheduleCampaignService],
})
export class ScheduleCampaignModule {}