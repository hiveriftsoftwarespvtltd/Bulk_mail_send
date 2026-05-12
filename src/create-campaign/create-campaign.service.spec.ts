import { Test, TestingModule } from '@nestjs/testing';
import { CreateCampaignService } from './create-campaign.service';

describe('CreateCampaignService', () => {
  let service: CreateCampaignService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreateCampaignService],
    }).compile();

    service = module.get<CreateCampaignService>(CreateCampaignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
