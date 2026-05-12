import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignDto } from './create-campaign-setting.dto';

export class UpdateCampaignSettingDto extends PartialType(CreateCampaignDto) {}
