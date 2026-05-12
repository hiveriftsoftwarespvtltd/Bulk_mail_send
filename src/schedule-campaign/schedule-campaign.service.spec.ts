import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleCampaignService } from './schedule-campaign.service';

describe('ScheduleCampaignService', () => {
  let service: ScheduleCampaignService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScheduleCampaignService],
    }).compile();
    service = module.get<ScheduleCampaignService>(ScheduleCampaignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  
  });
});
