import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  controllers: [TrackingController],
})
export class TrackingModule {}
