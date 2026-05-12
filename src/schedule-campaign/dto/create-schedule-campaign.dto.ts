// dto/create-schedule-campaign.dto.ts
import { IsArray, IsDateString, IsNumber, IsString } from 'class-validator';

export class CreateScheduleCampaignDto {
  @IsString()
  timezone: string;

  @IsArray()
  sendDays: string[];

  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsNumber()
  intervalMinutes: number;

  @IsDateString()
  campaignStartDate: Date;

  @IsNumber()
  maxLeadsPerDay: number;
}