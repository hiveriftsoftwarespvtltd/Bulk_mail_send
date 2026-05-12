import { Module } from '@nestjs/common';
import { CampaignSettingsService } from './campaign-settings.service';
import { CampaignSettingsController } from './campaign-settings.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from './entities/campaign-setting.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  controllers: [CampaignSettingsController],
  providers: [CampaignSettingsService],
})
export class CampaignSettingsModule {}