import { Module } from '@nestjs/common';
import { GoogleMailService } from './google-mail.service';
import { GoogleMailController } from './google-mail.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { GoogleMail, GoogleMailSchema } from './entities/google-mail.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GoogleMail.name, schema: GoogleMailSchema }])
  ],
  controllers: [GoogleMailController],
  providers: [GoogleMailService],
  exports: [GoogleMailService, MongooseModule]
})
export class GoogleMailModule { }
