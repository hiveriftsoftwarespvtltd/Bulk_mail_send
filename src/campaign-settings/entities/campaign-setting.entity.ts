import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CampaignDocument = Campaign & Document;

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ required: true })
  campaignName: string;

  @Prop({ required: true })
  userId: string;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);