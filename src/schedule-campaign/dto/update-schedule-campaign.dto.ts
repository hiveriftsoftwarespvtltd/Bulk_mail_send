// dto/update-schedule-campaign.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleCampaignDto } from './create-schedule-campaign.dto';

export class UpdateScheduleCampaignDto extends PartialType(CreateScheduleCampaignDto) {}