import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrackingDomainDocument = TrackingDomain & Document;

@Schema({ timestamps: true })
export class TrackingDomain {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  emailAccountId: string;

  @Prop({ required: true })
  domainName: string;

  @Prop({ required: true })
  cnameTarget: string;

  @Prop({ default: false })
  verified: boolean;
}

export const TrackingDomainSchema = SchemaFactory.createForClass(TrackingDomain);
