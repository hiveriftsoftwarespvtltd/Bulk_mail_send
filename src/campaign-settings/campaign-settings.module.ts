import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CampaignSettingsController } from './campaign-settings.controller';
import { CampaignSettingsService } from './campaign-settings.service';
import { Campaign, CampaignSchema } from './entities/campaign-setting.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Campaign.name, schema: CampaignSchema }]),
  ],
  controllers: [CampaignSettingsController],
  providers: [CampaignSettingsService],
  exports: [CampaignSettingsService],
})
export class CampaignSettingsModule {}
