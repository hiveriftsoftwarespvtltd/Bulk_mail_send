import { Test, TestingModule } from '@nestjs/testing';
import { SmtpSenderService } from './smtp-sender.service';

describe('SmtpSenderService', () => {
  let service: SmtpSenderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmtpSenderService],
    }).compile();

    service = module.get<SmtpSenderService>(SmtpSenderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
