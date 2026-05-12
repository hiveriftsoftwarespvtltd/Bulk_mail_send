import { IsEmail, IsString, IsOptional, IsNumber, IsEnum, ValidateNested, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

class SmtpConfigDto {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  user: string;

  @IsString()
  pass: string;

  @IsEmail()
  fromEmail: string;

  @IsString()
  fromName: string;

  @IsEnum(['SSL', 'TLS', 'NONE'])
  smtpSecurity: 'SSL' | 'TLS' | 'NONE';

  @IsOptional()
  @IsEmail()
  replyTo?: string;
}

class MailPayloadDto {
  @IsEmail()
  to: string; 

    
  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  text?: string;
}

export class SendDirectDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SmtpConfigDto)
  smtpConfig: SmtpConfigDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => MailPayloadDto)
  payload: MailPayloadDto;

  
}
