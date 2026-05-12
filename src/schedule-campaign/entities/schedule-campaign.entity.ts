import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScheduleCampaignDocument = ScheduleCampaign & Document;

@Schema({ timestamps: true })
export class ScheduleCampaign {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  timezone: string;

  @Prop({ type: [String], required: true })
  sendDays: string[];

  @Prop({
    type: {
      from: { type: String, required: true },
      to: { type: String, required: true },
    },
    _id: false,
  })
  timePeriod: {
    from: string;
    to: string;
  };

  @Prop({ required: true })
  intervalMinutes: number;

  @Prop({ required: true })
  campaignStartDate: Date;

  @Prop({ required: true })
  maxLeadsPerDay: number;
}

export const ScheduleCampaignSchema = SchemaFactory.createForClass(ScheduleCampaign);
