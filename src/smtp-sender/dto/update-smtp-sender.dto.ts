import { PartialType } from '@nestjs/mapped-types';
import { CreateSmtpSenderDto } from './create-smtp-sender.dto';

export class UpdateSmtpSenderDto extends PartialType(CreateSmtpSenderDto) {}