import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrackingDomainService } from './tracking-domain.service';
import { TrackingDomainController } from './tracking-domain.controller';
import { TrackingDomain, TrackingDomainSchema } from './schemas/tracking-domain.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackingDomain.name, schema: TrackingDomainSchema },
    ]),
  ],
  controllers: [TrackingDomainController],
  providers: [TrackingDomainService],
  exports: [TrackingDomainService]
})
export class TrackingDomainModule {}
