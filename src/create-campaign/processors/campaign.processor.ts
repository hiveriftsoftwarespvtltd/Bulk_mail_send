import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { CreateCampaignService } from '../create-campaign.service';

@Processor('campaign')
export class CampaignProcessor {
  constructor(private readonly campaignService: CreateCampaignService) {}

  @Process({ name: 'process-campaign', concurrency: 200 })
  async handleProcessCampaign(job: Job) {
    console.log(`🎯 Processing background job for campaign: ${job.data.campaignId}`);
    await this.campaignService.runCampaignJob(job.data);
  }
}
