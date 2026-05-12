import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectModel(EmailLog.name) private emailModel: Model<EmailLogDocument>,
    private configService: ConfigService,
  ) { }

  async sendEmailWithTracking(
    transporter: nodemailer.Transporter,
    smtpUser: string,
    recipient: string,
    subject: string,
    message: string,
    companyId: string,
    provider: 'SMTP' | 'GOOGLE' = 'SMTP',
    fromName?: string,
    replyTo?: string,
  ) {
    const backendUrl = this.configService.get('BACKEND_URL') || 'http://localhost:9000';
    if (!this.configService.get('BACKEND_URL')) {
      this.logger.warn('BACKEND_URL not found in .env, falling back to http://localhost:9000');
    }
    const trackingId = uuidv4();

    // 1. Inject Tracking Pixel at the TOP of the body for better reliability
    const pixelTag = `<img src="${backendUrl}/track/open/${trackingId}" width="1" height="1" style="display:none;" />`;
    let htmlMessage = pixelTag + message;

    // 2. Inject Tracking Links (Only wrap http/https web links)
    const linkRegex = /href="(https?:\/\/[^"]*)"/gi;
    htmlMessage = htmlMessage.replace(linkRegex, (match, url) => {
      return `href="${backendUrl}/track/click/${trackingId}?url=${encodeURIComponent(url)}"`;
    });

    try {
      const info = await transporter.sendMail({
        from: fromName ? `"${fromName}" <${smtpUser}>` : smtpUser,
        to: recipient,
        subject,
        html: htmlMessage,
        replyTo: replyTo || smtpUser,
      });

      const log = await this.emailModel.create({
        smtpEmail: smtpUser,
        recipient,
        subject,
        message: htmlMessage,
        status: 'SENT',
        trackingId,
        companyId,
        messageId: info.messageId,
        provider,
      });

      this.logger.log(`Email sent to ${recipient} (Message-ID: ${info.messageId})`);
      return new CustomResponse(200, `Email sent to ${recipient}`, log);
    } catch (error) {
      this.logger.error(`Failed to send email to ${recipient}: ${error.message}`);
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async sendBulkEmails(
    smtpConfig: any | any[],
    recipients: string[],
    subject: string,
    message: string,
    companyId: string,
  ) {
    try {
      const configs = Array.isArray(smtpConfig) ? smtpConfig : [smtpConfig];
      const transporters = configs.map(cfg => nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: {
          user: cfg.user,
          pass: cfg.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        family: 4,
        lookup: (hostname, options, callback) => {
          require('dns').lookup(hostname, { family: 4 }, callback);
        },
      } as any));

      const results: any[] = [];
      let currentSmtpIndex = 0;

      for (const recipient of recipients) {
        try {
          const cfg = configs[currentSmtpIndex % configs.length];
          const transporter = transporters[currentSmtpIndex % transporters.length];
          const { host, port, auth } = (transporter.options as any);
          const smtpUser = auth?.user;
          
          this.logger.log(`📧 [DEBUG] Attempting send via ${host}:${port} for user: ${smtpUser}`);

          const res = await this.sendEmailWithTracking(
            transporter,
            cfg.user,
            recipient,
            subject,
            message,
            companyId,
            'SMTP',
          );
          results.push(res);

          currentSmtpIndex++;

        } catch (error) {
          results.push({ recipient, error: error.message });
        }

        // Always wait between emails
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      return new CustomResponse(200, `Bulk email process completed for ${recipients.length} recipients using ${configs.length} SMTP accounts.`, results);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async sendBulkEmailsViaGoogle(
    googleConfigs: any | any[],
    recipients: string[],
    subject: string,
    message: string,
    companyId: string,
  ) {
    try {
      const configs = Array.isArray(googleConfigs) ? googleConfigs : [googleConfigs];
      const transporters = configs.map(cfg => nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: cfg.email,
          clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
          clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
          refreshToken: cfg.refreshToken,
          accessToken: cfg.accessToken,
        },
      } as any));

      const results: any[] = [];
      let currentAccountIndex = 0;

      for (const recipient of recipients) {
        try {
          const cfg = configs[currentAccountIndex % configs.length];
          const transporter = transporters[currentAccountIndex % transporters.length];

          const res = await this.sendEmailWithTracking(
            transporter,
            cfg.email,
            recipient,
            subject,
            message,
            companyId,
            'GOOGLE',
          );
          results.push(res);

          currentAccountIndex++;

        } catch (error) {
          results.push({ recipient, error: error.message });
        }

        // Always wait between emails
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      return new CustomResponse(200, `Bulk email process completed for ${recipients.length} recipients using ${configs.length} Google accounts.`, results);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }
}
