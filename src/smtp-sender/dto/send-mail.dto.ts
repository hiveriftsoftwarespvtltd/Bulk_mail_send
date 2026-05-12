import { IsEmail, IsString, IsOptional } from 'class-validator';

export class SendMailDto {
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
