import { Test, TestingModule } from '@nestjs/testing';
import { CreateCampaignController } from './create-campaign.controller';
import { CreateCampaignService } from './create-campaign.service';

describe('CreateCampaignController', () => {
  let controller: CreateCampaignController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreateCampaignController],
      providers: [CreateCampaignService],
    }).compile();

    controller = module.get<CreateCampaignController>(CreateCampaignController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
