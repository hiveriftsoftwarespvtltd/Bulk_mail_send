// dto/create-schedule-campaign.dto.ts
import { IsArray, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsNumber()
  intervalValue?: number;

  @IsOptional()
  @IsString()
  intervalUnit?: string;

  @IsDateString()
  campaignStartDate: Date;

  @IsNumber()
  maxLeadsPerDay: number;
}