import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CampaignDocument = Campaign & Document;

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  companyId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: Object })
  template: {
    subject: string;
    body: string;
  };

  @Prop({ type: Object })
  mapping: Record<string, string>;

  @Prop({ type: Array })
  leads: any[];

  @Prop({ default: 'DRAFT' })
  status: string;

  @Prop()
  signature: string;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
