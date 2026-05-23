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
import { GoogleMailService } from './google-mail.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('google-mail')
export class GoogleMailController {
  constructor(
    private readonly googleMailService: GoogleMailService,
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
  async getAuthUrl(@Request() req) {
    const tenantId = req.user?.companyId;
    if (!tenantId) {
      throw new BadRequestException('Workspace not found. Please log in again.');
    }

    let frontendUrl = '';
    const referer = req.headers.referer || req.headers.origin;
    if (referer) {
      try {
        const url = new URL(referer as string);
        frontendUrl = `${url.protocol}//${url.host}`;
      } catch {
        // ignore invalid referer
      }
    }

    return this.googleMailService.getAuthUrl(tenantId, frontendUrl);
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
      return res.redirect(`${fallbackFrontend}/dashboard?${q}`);
    };

    if (oauthError) {
      return redirectWith({ googleAuth: 'error', message: oauthError });
    }

    try {
      const { frontendUrl } = await this.googleMailService.handleCallback(code, state);
      const finalFrontend = (frontendUrl || fallbackFrontend).replace(/\/$/, '');
      return res.redirect(`${finalFrontend}/dashboard?googleAuth=success`);
    } catch (err: any) {
      const message = err?.message || 'Google connection failed';
      return redirectWith({ googleAuth: 'error', message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listAccounts(@Request() req) {
    const tenantId = req.user?.companyId;
    if (!tenantId) {
      throw new BadRequestException('Workspace not found. Please log in again.');
    }
    return this.googleMailService.listAccounts(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const tenantId = req.user?.companyId;
    if (!tenantId) {
      throw new BadRequestException('Workspace not found. Please log in again.');
    }
    return this.googleMailService.remove(id, tenantId);
  }
}
