import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CreateCampaignDocument = CreateCampaign & Document;

@Schema({ timestamps: true })
export class CreateCampaign {

  // SaaS (multi-tenant)
  @Prop({ required: true })
  userId: string;

  
  @Prop({ required: true })
  workspaceId: string;

  // Step 3 (Image 3)
  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  body: string;

  @Prop({ default: 'Untitled Campaign' })
  name: string;

  @Prop({ default: 'DRAFT' })
  status: string;

  // Stats Counters
  @Prop({ default: 0 })
  sent: number;

  @Prop({ default: 0 })
  opened: number;

  @Prop({ default: 0 })
  replied: number;

  @Prop({ default: 0 })
  positiveReply: number;

  @Prop({ default: 0 })
  bounced: number;

  @Prop({ default: 0 })
  senderBounced: number;

  // CSV Data
  @Prop({ type: Array, default: [] })
  contacts: any[];

  // Mapping
  @Prop()
  companyField: string;

  @Prop()
  ownerField: string;

  @Prop()
  emailField: string;
  @Prop({ type: Object })
  mapping: any;

  // Scheduling
  @Prop({ default: 0 })
  delayMinutes: number;

  @Prop()
  scheduledAt: Date;
}

export const CreateCampaignSchema = SchemaFactory.createForClass(CreateCampaign);