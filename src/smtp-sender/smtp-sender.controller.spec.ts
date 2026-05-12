import { Test, TestingModule } from '@nestjs/testing';
import { SmtpSenderController } from './smtp-sender.controller';
import { SmtpSenderService } from './smtp-sender.service';

describe('SmtpSenderController', () => {
  let controller: SmtpSenderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmtpSenderController],
      providers: [SmtpSenderService],
    }).compile();

    controller = module.get<SmtpSenderController>(SmtpSenderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
