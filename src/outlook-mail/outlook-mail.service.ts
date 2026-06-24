import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OutlookMail, OutlookMailDocument } from './entities/outlook-mail.entity';
import { ConfigService } from '@nestjs/config';
import CustomResponse from 'src/provider/custom-response.service';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';

export interface OAuthStatePayload {
  tenantId: string;
  frontendUrl: string;
}

@Injectable()
export class OutlookMailService {
  private readonly logger = new Logger(OutlookMailService.name);

  constructor(
    @InjectModel(OutlookMail.name) private outlookMailModel: Model<OutlookMailDocument>,
    private configService: ConfigService,
  ) {}

  private resolveRedirectUri(): string {
    const explicit = this.configService.get<string>('OUTLOOK_REDIRECT_URI');
    if (explicit?.trim()) {
      return explicit.trim().replace(/\/$/, '');
    }
    const backend = (this.configService.get<string>('BACKEND_URL') || 'http://localhost:9000')
      .trim()
      .replace(/\/$/, '');
    return `${backend}/outlook-mail/callback`;
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
        new CustomError(400, 'Workspace ID missing. Please log out and log in again, then connect Outlook.'),
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
      // ignore
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

    const clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID');
    const redirectUri = this.resolveRedirectUri();
    const state = this.encodeOAuthState(tenantId, redirectUrl);
    const scopes = [
      'User.Read',
      'Mail.Send',
      'Mail.Read',
      'Mail.ReadWrite',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId || '',
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes,
      state: state,
      prompt: 'select_account',
    });

    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    this.logger.log(`Outlook OAuth started for tenantId=${tenantId}`);
    return new CustomResponse(200, 'Outlook OAuth URL generated', { url });
  }

  async handleCallback(code: string, state: string) {
    const { tenantId, frontendUrl } = this.parseOAuthState(state);

    try {
      if (!code) {
        throw new CustomError(
          400,
          'Authorization code is missing. You must log in via the Microsoft Consent Screen first.',
        );
      }

      this.assertValidTenantId(tenantId);

      const clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID');
      const clientSecret = this.configService.get<string>('OUTLOOK_CLIENT_SECRET');
      const redirectUri = this.resolveRedirectUri();

      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId || '',
          client_secret: clientSecret || '',
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        throw new Error(`Failed to exchange token: ${tokenResponse.status} - ${errText}`);
      }

      const tokens = await tokenResponse.json();
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;

      // Get user profile
      const userProfileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userProfileResponse.ok) {
        const errText = await userProfileResponse.text();
        throw new Error(`Failed to get Microsoft user profile: ${userProfileResponse.status} - ${errText}`);
      }

      const userProfile = await userProfileResponse.json();
      const email = userProfile.mail || userProfile.userPrincipalName || '';
      const name = userProfile.displayName || '';

      if (!email) {
        throw new Error('Microsoft profile did not contain a valid email address.');
      }

      let account = await this.outlookMailModel.findOne({ tenantId, email });
      if (account) {
        account.accessToken = accessToken;
        if (refreshToken) {
          account.refreshToken = refreshToken;
        }
        account.name = name;
        await account.save();
      } else {
        if (!refreshToken) {
          throw new CustomError(
            400,
            'Microsoft did not provide a refresh token. Reconnect and ensure offline_access is consented.',
          );
        }
        account = await this.outlookMailModel.create({
          tenantId,
          email,
          name,
          accessToken,
          refreshToken,
        });
      }

      this.logger.log(`Outlook connected: ${email} → tenantId=${tenantId}`);
      return { tenantId, frontendUrl };
    } catch (error: any) {
      this.logger.error(`OUTLOOK OAUTH CALLBACK FAILED: ${error.message}`);
      const status = error?.status || error?.statusCode || 500;
      const message = error?.message || 'Outlook OAuth failed';
      throwException(new CustomError(status, message));
      throw error;
    }
  }

  async verifyOutlookConnection(id: string, tenantId: string) {
    this.assertValidTenantId(tenantId);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const account = await this.outlookMailModel.findOne({ _id: id, tenantId });
    if (!account) {
      throwException(new CustomError(404, 'Outlook account not found'));
      throw new Error('Outlook account not found');
    }

    try {
      const token = await this.refreshAccessToken(account.refreshToken);
      if (!token) {
        throw new Error('Failed to retrieve access token.');
      }
      return new CustomResponse(200, 'Outlook account is connected and valid', { status: 'connected', email: account.email });
    } catch (error: any) {
      this.logger.error(`Outlook connection check failed for ${account.email}: ${error.message}`);
      throwException(
        new CustomError(400, `Outlook connection invalid or expired: ${error.message}. Please delete and reconnect this account.`)
      );
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID');
    const clientSecret = this.configService.get<string>('OUTLOOK_CLIENT_SECRET');

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Microsoft Token Refresh Failed: ${response.status} - ${errText}`);
      throw new Error('Microsoft token refresh failed.');
    }

    const data = await response.json();
    await this.outlookMailModel.updateOne(
      { refreshToken: refreshToken },
      { $set: { accessToken: data.access_token } }
    );
    return data.access_token;
  }

  async listAccounts(tenantId: string) {
    this.assertValidTenantId(tenantId);

    const accounts = await this.outlookMailModel
      .find({ tenantId })
      .select('-accessToken -refreshToken')
      .sort({ createdAt: -1 })
      .lean();

    return new CustomResponse(200, 'Outlook accounts fetched successfully', accounts);
  }

  async remove(id: string, tenantId: string) {
    this.assertValidTenantId(tenantId);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const result = await this.outlookMailModel.findOneAndDelete({ _id: id, tenantId });
    if (!result) {
      throwException(new CustomError(404, 'Outlook account not found'));
    }
    return new CustomResponse(200, 'Outlook account deleted successfully');
  }
}
