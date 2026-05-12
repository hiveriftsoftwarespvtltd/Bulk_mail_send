import { Controller, Get, Query, Res, Param, UseGuards, Request, Delete } from '@nestjs/common';
import { GoogleMailService } from './google-mail.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('google-mail')
export class GoogleMailController {
  constructor(
    private readonly googleMailService: GoogleMailService,
    private readonly configService: ConfigService
  ) { }

  @UseGuards(JwtAuthGuard)
  @Get('auth-url')
  async getAuthUrl(@Request() req) {
    const tenantId = req.user.companyId;
    // Get the base frontend URL from the Referer header automatically
    const referer = req.headers.referer;
    let frontendUrl = '';
    if (referer) {
      const url = new URL(referer);
      frontendUrl = `${url.protocol}//${url.host}`;
    }
    return this.googleMailService.getAuthUrl(tenantId, frontendUrl);
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    // Split state to get tenantId and redirectUrl
    const [tenantId, redirectUrl] = (state || '').split('|');

    await this.googleMailService.handleCallback(code, state);

    // Use the redirectUrl from state, or fallback to config
    const finalRedirect = redirectUrl || this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    res.redirect(`${finalRedirect}/dashboard?googleAuth=success`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listAccounts(@Request() req) {
    const tenantId = req.user.companyId;
    return this.googleMailService.listAccounts(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.googleMailService.remove(id);
  }
}
