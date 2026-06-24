import {
  Controller,
  Get,
  Query,
  Res,
  Param, 
  UseGuards,
  Request,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { OutlookMailService } from './outlook-mail.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('outlook-mail')
export class OutlookMailController {
  constructor(
    private readonly outlookMailService: OutlookMailService,
    private readonly configService: ConfigService,
  ) {}

  private defaultFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'https://mailpipes.online'
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth-url')
  async getAuthUrl(
    @Request() req,
    @Query('tenantId') queryTenantId: string,
    @Query('redirectUrl') queryRedirectUrl: string,
  ) {
    // Priority: JWT user companyId → query param tenantId → fallback
    const tenantId = req.user?.companyId || queryTenantId || 'local-dev-tenant';

    if (!tenantId) {
      throw new BadRequestException('Workspace not found. Provide tenantId as query param or log in.');
    }

    // Detect frontend URL from referer/origin header or query param
    let frontendUrl = queryRedirectUrl || '';
    if (!frontendUrl) {
      const referer = req.headers.referer || req.headers.origin;
      if (referer) {
        try {
          const url = new URL(referer as string);
          frontendUrl = `${url.protocol}//${url.host}`;
        } catch {
          // ignore invalid referer
        }
      }
    }

    return this.outlookMailService.getAuthUrl(tenantId, frontendUrl);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Res() res: Response,
  ) {
    const fallbackFrontend = this.defaultFrontendUrl();

    const redirectWith = (params: Record<string, string>) => {
      const q = new URLSearchParams(params).toString();
      let target = fallbackFrontend;
      if (!target.includes('/email-accounts')) {
        target = `${target}/email-accounts`;
      }
      return res.redirect(`${target}?${q}`);
    };

    if (oauthError) {
      return redirectWith({ outlookAuth: 'error', message: oauthError });
    }

    try {
      const { frontendUrl } = await this.outlookMailService.handleCallback(code, state);
      let finalFrontend = (frontendUrl || fallbackFrontend).replace(/\/$/, '');
      if (!finalFrontend.includes('/email-accounts')) {
        finalFrontend = `${finalFrontend}/email-accounts`;
      }
      return res.redirect(`${finalFrontend}?outlookAuth=success`);
    } catch (err: any) {
      const message = err?.message || 'Outlook connection failed';
      return redirectWith({ outlookAuth: 'error', message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listAccounts(@Request() req) {
    const tenantId = req.user?.companyId;
    if (!tenantId) {
      throw new BadRequestException('Workspace not found. Please log in again.');
    }
    return this.outlookMailService.listAccounts(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/verify')
  async verifyConnection(@Param('id') id: string, @Request() req) {
    const tenantId = req.user?.companyId;
    if (!tenantId) {
      throw new BadRequestException('Workspace not found. Please log in again.');
    }
    return this.outlookMailService.verifyOutlookConnection(id, tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const tenantId = req.user?.companyId;
    if (!tenantId) {
      throw new BadRequestException('Workspace not found. Please log in again.');
    }
    return this.outlookMailService.remove(id, tenantId);
  }
}
