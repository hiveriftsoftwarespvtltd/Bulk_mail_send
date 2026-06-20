import { Module } from '@nestjs/common';
import { OutlookMailService } from './outlook-mail.service';
import { OutlookMailController } from './outlook-mail.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { OutlookMail, OutlookMailSchema } from './entities/outlook-mail.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OutlookMail.name, schema: OutlookMailSchema }])
  ],
  controllers: [OutlookMailController],
  providers: [OutlookMailService],
  exports: [OutlookMailService, MongooseModule]
})
export class OutlookMailModule {}
