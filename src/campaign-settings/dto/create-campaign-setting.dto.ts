import { IsNotEmpty } from 'class-validator';

export class CreateCampaignDto {
  @IsNotEmpty()
  campaignName: string;
}