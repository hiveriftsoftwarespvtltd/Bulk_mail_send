import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SmtpSenderDocument = SmtpSender & Document;

@Schema({ timestamps: true })
export class SmtpSender { 
  
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  fromName: string;

  @Prop({ required: true })
  fromEmail: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  smtpHost: string;

  @Prop({ required: true })
  smtpPort: number;

  @Prop({ enum: ['SSL', 'TLS', 'NONE'], default: 'SSL' })
  smtpSecurity: string;

  @Prop({ default: 25 })
  messagePerDay: number;

  @Prop({ default: 1 })
  minTimeGap: number;
  
  @Prop({ default: false })
  useCustomReplyTo: boolean;


  @Prop()
  @Prop()
  replyTo: string;

}
export const SmtpSenderSchema = SchemaFactory.createForClass(SmtpSender);