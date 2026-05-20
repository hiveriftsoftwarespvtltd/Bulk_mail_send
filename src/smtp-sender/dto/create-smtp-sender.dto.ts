import {
  IsString,
  IsEmail,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateSmtpSenderDto {
  @IsString()
  fromName: string;

  @IsEmail()
  fromEmail: string;

  @IsString()
  userName: string;

  @IsString()
  password: string;

  @IsString()
  smtpHost: string;

  @IsNumber()
  smtpPort: number;

  @IsEnum(['SSL', 'TLS', 'NONE'])
  smtpSecurity: 'SSL' | 'TLS' | 'NONE';

  @IsNumber()
  messagePerDay: number;

  @IsNumber()
  minTimeGap: number;

  @IsBoolean()
  useCustomReplyTo: boolean;

  @IsOptional()
  @IsEmail()
  replyTo: string;

  // IMAP (for fetching replies) — optional, auto-derived from smtpHost if not provided
  @IsOptional()
  @IsString()
  imapHost: string;

  @IsOptional()
  @IsNumber()
  imapPort: number;
}