import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GoogleMailDocument = GoogleMail & Document;

@Schema({ timestamps: true })
export class GoogleMail {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: false })
  name: string;

  @Prop({ required: true })
  accessToken: string;

  @Prop({ required: true })
  refreshToken: string;

  @Prop({ default: 500 })
  messagePerDay: number;

  @Prop({ default: 1 })
  minTimeGap: number;
}
export const GoogleMailSchema = SchemaFactory.createForClass(GoogleMail);
