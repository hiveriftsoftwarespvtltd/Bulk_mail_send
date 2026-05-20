import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailLogDocument = EmailLog & Document;

@Schema({ timestamps: true })
export class EmailLog {
  @Prop({ required: true })
  smtpEmail: string;

  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true })
  recipient: string;

  @Prop({ required: true })
  subject: string;

  @Prop()
  message: string;

  @Prop({ default: 'SENT' })
  status: string;                              

  @Prop({ required: true, unique: true })
  trackingId: string;

  @Prop()
  messageId: string;

  @Prop({ enum: ['SMTP', 'GOOGLE'], default: 'SMTP' })
  provider: string;

  @Prop()
  openedAt: Date;

  @Prop()
  clickedAt: Date;

  @Prop()
  ipAddress: string;

  @Prop()
  device: string;

  @Prop({ index: true })
  campaignId: string;
}

export const EmailLogSchema = SchemaFactory.createForClass(EmailLog);
