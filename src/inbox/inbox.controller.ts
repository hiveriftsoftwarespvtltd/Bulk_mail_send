import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) { }

  @Get('accounts')
  async getAccounts(@Request() req) {
    const companyId = req.user.companyId;
    return this.inboxService.listAllAccounts(companyId);
  }

  @Get(':accountId/sent')
  async getSentMails(
    @Param('accountId') accountId: string,
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const companyId = req.user.companyId;
    return this.inboxService.getSentMails(accountId, companyId, +page, +limit);
  }

  @Get(':accountId/replies')
  async getReplies(
    @Param('accountId') accountId: string,
    @Request() req,
    @Query('messageId') messageId: string,
  ) {
    const companyId = req.user.companyId;
    return this.inboxService.getReplies(accountId, companyId, messageId);
  }

  @Get(':accountId/all-replies')
  async getAllReplies(
    @Param('accountId') accountId: string,
    @Request() req,
  ) {
    const companyId = req.user.companyId;
    return this.inboxService.getAllRecentReplies(accountId, companyId);
  }

  @Get('thread/:accountId/:messageId')
  async getThread(
    @Param('accountId') accountId: string,
    @Param('messageId') messageId: string,
    @Request() req,
  ) {
    const companyId = req.user.companyId;
    return this.inboxService.getThread(accountId, companyId, messageId);
  }
}
