import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleMail, GoogleMailDocument } from './entities/google-mail.entity';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import CustomResponse from 'src/provider/custom-response.service';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';

export interface OAuthStatePayload {
  tenantId: string;
  frontendUrl: string;
}

@Injectable()
export class GoogleMailService {
  private readonly logger = new Logger(GoogleMailService.name);
  private oauth2Client;

  constructor(
    @InjectModel(GoogleMail.name) private googleMailModel: Model<GoogleMailDocument>,
    private configService: ConfigService,
  ) {
    const redirectUri = this.resolveRedirectUri();
    this.logger.log(`Google OAuth redirect URI: ${redirectUri}`);

    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri,
    );
  }

  /** Live: https://mailpipes.online/mailpipes_api/google-mail/callback */
  private resolveRedirectUri(): string {
    const explicit = this.configService.get<string>('GOOGLE_REDIRECT_URI');
    if (explicit?.trim()) {
      return explicit.trim().replace(/\/$/, '');
    }
    const backend = (this.configService.get<string>('BACKEND_URL') || 'http://localhost:9000')
      .trim()
      .replace(/\/$/, '');
    return `${backend}/google-mail/callback`;
  }

  private resolveFrontendUrl(candidate?: string): string {
    const fromEnv = this.configService.get<string>('FRONTEND_URL')?.trim();
    const fallback = fromEnv || 'https://mailpipes.online';
    const url = (candidate?.trim() || fallback).replace(/\/$/, '');
    return url;
  }

  private assertValidTenantId(tenantId: string) {
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
      throwException(
        new CustomError(400, 'Workspace ID missing. Please log out and log in again, then connect Google.'),
      );
    }
  }

  encodeOAuthState(tenantId: string, frontendUrl?: string): string {
    const payload = {
      t: tenantId,
      r: this.resolveFrontendUrl(frontendUrl),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  parseOAuthState(state: string): OAuthStatePayload {
    if (!state?.trim()) {
      return { tenantId: '', frontendUrl: '' };
    }

    try {
      const json = Buffer.from(state, 'base64url').toString('utf8');
      const decoded = JSON.parse(json) as { t?: string; r?: string };
      if (decoded?.t) {
        return {
          tenantId: decoded.t,
          frontendUrl: decoded.r || '',
        };
      }
    } catch {
      // Legacy: tenantId|https://frontend.url
    }

    const pipeIndex = state.indexOf('|');
    if (pipeIndex === -1) {
      return { tenantId: state, frontendUrl: '' };
    }
    return {
      tenantId: state.slice(0, pipeIndex),
      frontendUrl: state.slice(pipeIndex + 1),
    };
  }

  getAuthUrl(tenantId: string, redirectUrl?: string) {
    this.assertValidTenantId(tenantId);

    const scopes = [
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const state = this.encodeOAuthState(tenantId, redirectUrl);

    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    });

    this.logger.log(`OAuth started for tenantId=${tenantId}`);
    return new CustomResponse(200, 'OAuth URL generated', { url });
  }

  async handleCallback(code: string, state: string) {
    const { tenantId, frontendUrl } = this.parseOAuthState(state);

    try {
      if (!code) {
        throw new CustomError(
          400,
          'Authorization code is missing. You must log in via the Google Consent Screen first.',
        );
      }

      this.assertValidTenantId(tenantId);

      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      if (!tokens.refresh_token) {
        this.logger.warn(
          `No refresh_token for tenantId=${tenantId}. User may need to revoke app access in Google Account and reconnect.`,
        );
      }

      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2',
      });

      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email || '';
      const name = userInfo.data.name || '';

      let account = await this.googleMailModel.findOne({ tenantId, email });
      if (account) {
        account.accessToken = tokens.access_token;
        if (tokens.refresh_token) {
          account.refreshToken = tokens.refresh_token;
        }
        account.name = name;
        await account.save();
      } else {
        if (!tokens.refresh_token) {
          throw new CustomError(
            400,
            'Google did not provide a refresh token. Remove app access in your Google Account settings and try Connect again.',
          );
        }
        account = await this.googleMailModel.create({
          tenantId,
          email,
          name,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
      }

      this.logger.log(`Google connected: ${email} → tenantId=${tenantId}`);
      return { tenantId, frontendUrl };
    } catch (error: any) {
      this.logger.error(`OAUTH CALLBACK FAILED: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`Details: ${JSON.stringify(error.response.data)}`);
      }
      const status = error?.status || error?.statusCode || 500;
      const message = error?.message || 'Google OAuth failed';
      throwException(new CustomError(status, message));
      throw error;
    }
  }

  async verifyGoogleConnection(id: string, tenantId: string) {
    this.assertValidTenantId(tenantId);

    const account = await this.googleMailModel.findOne({ _id: id, tenantId });
    if (!account) {
      throwException(new CustomError(404, 'Google account not found'));
      throw new Error('Google account not found');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: account.refreshToken });

    try {
      const { token } = await oauth2Client.getAccessToken();
      if (!token) {
        throw new Error('Failed to retrieve access token.');
      }
      return new CustomResponse(200, 'Google account is connected and valid', { status: 'connected', email: account.email });
    } catch (error: any) {
      this.logger.error(`Google Mail connection check failed for ${account.email}: ${error.message}`);
      throwException(
        new CustomError(400, `Google connection invalid or expired: ${error.message}. Please delete and reconnect this account.`)
      );
    }
  }

  async listAccounts(tenantId: string) {
    this.assertValidTenantId(tenantId);

    const accounts = await this.googleMailModel
      .find({ tenantId })
      .select('-accessToken -refreshToken')
      .sort({ createdAt: -1 })
      .lean();

    return new CustomResponse(200, 'Google accounts fetched successfully', accounts);
  }

  async remove(id: string, tenantId: string) {
    this.assertValidTenantId(tenantId);

    const result = await this.googleMailModel.findOneAndDelete({ _id: id, tenantId });
    if (!result) {
      throwException(new CustomError(404, 'Google account not found'));
    }
    return new CustomResponse(200, 'Google account deleted successfully');
  }
}
