import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleMail, GoogleMailDocument } from './entities/google-mail.entity';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import CustomResponse from 'src/provider/custom-response.service';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';

@Injectable()
export class GoogleMailService {
  private readonly logger = new Logger(GoogleMailService.name);
  private oauth2Client;

  constructor(
    @InjectModel(GoogleMail.name) private googleMailModel: Model<GoogleMailDocument>,
    private configService: ConfigService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:9000/google-mail/callback'
    );
  }

  getAuthUrl(tenantId: string, redirectUrl?: string) {
    const scopes = [
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    // Combine tenantId and redirectUrl into state
    // Format: tenantId|redirectUrl
    const state = redirectUrl ? `${tenantId}|${redirectUrl}` : tenantId;

    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: state
    });

    return new CustomResponse(200, 'OAuth URL generated', { url });
  }

  async handleCallback(code: string, state: string) {
    try {
      if (!code) {
        throw new CustomError(400, "Authorization code is missing. You must log in via the Google Consent Screen first.");
      }

      // Split state to get real tenantId
      const [tenantId] = (state || '').split('|');

      if (!tenantId) {
        throw new CustomError(400, "Tenant ID (state) is missing.");
      }

      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2',
      });

      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email || '';
      const name = userInfo.data.name || '';

      if (!state) {
        throw new CustomError(400, "Tenant ID not provided in state");
      }

      // Save or update
      let account = await this.googleMailModel.findOne({ tenantId, email });
      if (account) {
        account.accessToken = tokens.access_token;
        if (tokens.refresh_token) {
          account.refreshToken = tokens.refresh_token;
        }
        account.name = name;
        await account.save();
      } else {
        account = await this.googleMailModel.create({
          tenantId,
          email,
          name,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
      }

      return new CustomResponse(200, 'Google Account connected successfully', account);
    } catch (error) {
      this.logger.error(`❌ OAUTH CALLBACK FAILED: ${error.message}`);
      if (error.response && error.response.data) {
        this.logger.error(`Details: ${JSON.stringify(error.response.data)}`);
      }
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async listAccounts(tenantId: string) {
    const accounts = await this.googleMailModel.find({ tenantId });
    return new CustomResponse(200, 'Google accounts retrieved', accounts);
  }

  async remove(id: string) {
    const result = await this.googleMailModel.findByIdAndDelete(id);
    if (!result) {
      throwException(new CustomError(404, 'Google account not found'));
    }
    return new CustomResponse(200, 'Google account deleted successfully');
  }
}
