import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
export class CreateCreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsNotEmpty()
  companyField: string;

  @IsString()
  @IsNotEmpty()
  ownerField: string;

  @IsString()
  @IsNotEmpty()
  emailField: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  trackingDomainId?: string;

  @IsOptional()
  selectedAccountIds?: string[];
}