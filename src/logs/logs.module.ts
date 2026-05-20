import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailLog, EmailLogSchema } from './schemas/email-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: EmailLog.name, schema: EmailLogSchema }]),
  ],
  exports: [MongooseModule],
})
export class LogsModule {}
