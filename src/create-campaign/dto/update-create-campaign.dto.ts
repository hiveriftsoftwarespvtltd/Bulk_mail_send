import { PartialType } from '@nestjs/mapped-types';
import { CreateCreateCampaignDto } from './create-create-campaign.dto';

export class UpdateCreateCampaignDto extends PartialType(CreateCreateCampaignDto) {}
