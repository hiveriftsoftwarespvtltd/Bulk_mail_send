import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  action: string; 

  @Prop({ required: true })
  email: string;

  @Prop()
  companyId: string;

  @Prop()
  ipAddress: string;

  @Prop()
  device: string;

  @Prop()
  endpoint: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
