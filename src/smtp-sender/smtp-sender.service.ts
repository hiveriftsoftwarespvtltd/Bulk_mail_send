import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SmtpSender } from './entities/smtp-sender.entity';
import { Model } from 'mongoose';
import { GoogleMail } from '../google-mail/entities/google-mail.entity';
import * as nodemailer from 'nodemailer';
import { SendMailDto } from './dto/send-mail.dto';
import { SendDirectDto } from './dto/send-direct.dto';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SmtpSenderService {
  private readonly logger = new Logger(SmtpSenderService.name);
  constructor(
    @InjectModel(SmtpSender.name)
    private model: Model<SmtpSender>,
    @InjectModel(GoogleMail.name)
    private googleMailModel: Model<GoogleMail>,
    private mailService: MailService,
  ) { }

  private async verifySmtpConnection(config: any) {
    const host = config.smtpHost;
    const port = config.smtpPort;
    const user = config.userName;
    const pass = config.password;

    if (!host || !user || !pass) {
      throw new CustomError(400, 'Missing SMTP configuration details (host, username, password)');
    }

    const transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: {
        user: user.trim(),
        pass: pass.trim(),
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    } as any);

    try {
      await transporter.verify();
    } catch (error: any) {
      this.logger.error(`SMTP Connection verification failed for ${user}: ${error.message}`);
      let userFriendlyMessage = error.message;

      if (
        error.message.includes('535') || 
        error.message.includes('BadCredentials') || 
        error.message.toLowerCase().includes('username and password not accepted')
      ) {
        if (host.toLowerCase().includes('gmail') || user.toLowerCase().endsWith('@gmail.com')) {
          userFriendlyMessage = `Invalid credentials. Gmail SMTP requires a 16-character App Password (NOT your normal Gmail password). Please enable 2-Step Verification and generate an App Password in your Google Account settings under Security.`;
        } else {
          userFriendlyMessage = `Invalid credentials: Username or password not accepted by the SMTP server.`;
        }
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('ENOTFOUND')) {
        userFriendlyMessage = `Connection timed out or host not found. Please verify the SMTP Host (${host}) and SMTP Port (${port}).`;
      }

      throw new CustomError(400, `SMTP connection failed: ${userFriendlyMessage}`);
    }
  }

  async create(dto: any, tenantId: string) {
    try {
      await this.verifySmtpConnection(dto);
      const data = await this.model.create({ ...dto, tenantId });
      return new CustomResponse(201, 'SMTP configuration created successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async findAll(tenantId: string) {
    try {
      const data = await this.model.find({ tenantId }).sort({ createdAt: -1 });
      return data;
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async listAllAccounts(tenantId: string) {
    try {
      if (!tenantId || tenantId === 'undefined') {
        throwException(new CustomError(400, 'Workspace not found. Please log in again.'));
      }

      // Fetch SMTP accounts
      const smtpAccounts = await this.model.find({ tenantId }).lean();
      const smtpFormatted = smtpAccounts.map(acc => ({
        ...acc,
        type: 'SMTP',
        displayName: acc.fromEmail || acc.userName
      }));

      // Fetch Google accounts (no tokens in list)
      const googleAccounts = await this.googleMailModel
        .find({ tenantId })
        .select('-accessToken -refreshToken')
        .lean();
      const googleFormatted = googleAccounts.map(acc => ({
        ...acc,
        type: 'GOOGLE',
        displayName: acc.email
      }));

      // Combine both
      const allAccounts = [...smtpFormatted, ...googleFormatted];

      return new CustomResponse(200, 'All accounts fetched successfully', allAccounts);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async findOne(id: string, tenantId: string) {
    try {
      const data = await this.model.findOne({ _id: id, tenantId });
      if (!data) throw new NotFoundException('Not found');
      return data; // Keeping this raw for internal use if needed, but wrapping in sendMail
    } catch (error) {
      throwException(new CustomError(error.status || 404, error.message));
    }
  }

  // Add findOneRaw for internal calls that don't want CustomResponse
  private async findOneInternal(id: string, tenantId: string) {
    const data = await this.model.findOne({ _id: id, tenantId });
    if (!data) throw new NotFoundException('Not found');
    return data;
  }

  async update(id: string, dto: any, tenantId: string) {
    try {
      const existing = await this.model.findOne({ _id: id, tenantId });
      if (!existing) throw new NotFoundException('Not found');

      const mergedConfig = {
        smtpHost: dto.smtpHost !== undefined ? dto.smtpHost : existing.smtpHost,
        smtpPort: dto.smtpPort !== undefined ? dto.smtpPort : existing.smtpPort,
        userName: dto.userName !== undefined ? dto.userName : existing.userName,
        password: dto.password !== undefined ? dto.password : existing.password,
      };

      const connectionDetailsChanged = 
        (dto.smtpHost !== undefined && dto.smtpHost !== existing.smtpHost) ||
        (dto.smtpPort !== undefined && dto.smtpPort !== existing.smtpPort) ||
        (dto.userName !== undefined && dto.userName !== existing.userName) ||
        (dto.password !== undefined && dto.password !== existing.password);

      if (connectionDetailsChanged) {
        await this.verifySmtpConnection(mergedConfig);
      }

      const updated = await this.model.findOneAndUpdate(
        { _id: id, tenantId },
        dto,
        { returnDocument: 'after' },
      );

      if (!updated) throw new NotFoundException('Not found');
      return new CustomResponse(200, 'SMTP configuration updated successfully', updated);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async delete(id: string, tenantId: string) {
    try {
      const deleted = await this.model.findOneAndDelete({ _id: id, tenantId });
      if (!deleted) throw new NotFoundException('Not found');
      return new CustomResponse(200, 'SMTP configuration deleted successfully', deleted);
    } catch (error) {
      throwException(new CustomError(error.status || 404, error.message));
    }
  }

  // 🔥 SEND EMAIL (VIA DB CONFIG)
  async sendMail(
    id: string,
    tenantId: string,
    payload: SendMailDto,
  )
  async sendMail(
    id: string,
    tenantId: string,
    payload: SendMailDto,
  ) {
    try {
      if (!payload || !payload.to) {
        throw new Error('Mail payload "to" is missing');
      }
      const config = await this.findOneInternal(id, tenantId);

      const result = await this.executeSend(
        {
          host: config.smtpHost,
          port: config.smtpPort,
          user: config.userName ? config.userName.trim() : '',
          pass: config.password ? config.password.trim() : '',
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          smtpSecurity: config.smtpSecurity as any,
          replyTo: config.useCustomReplyTo ? config.replyTo : config.fromEmail
        },
        payload
      );
      return new CustomResponse(200, `Email sent successfully from ${config.fromEmail}`, result);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async sendMailDirect(dto: SendDirectDto) {
    try {
      if (!dto || !dto.smtpConfig) {
        throw new Error('Invalid request: smtpConfig is missing in the body.');
      }

      const result = await this.executeSend(
        {
          ...dto.smtpConfig,
          replyTo: dto.smtpConfig.replyTo || dto.smtpConfig.fromEmail
        },
        dto.payload
      );

      return new CustomResponse(200, `Direct email sent successfully from ${dto.smtpConfig.fromEmail}`, result);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }
  private async executeSend(
    config: any,
    payload: SendMailDto,
  ) {
    try {
      const host = config.host || config.smtpHost;
      const port = config.port || config.smtpPort;
      const user = config.user || config.userName;
      const pass = config.pass || config.password;
      const fromEmail = config.fromEmail || user;
      const fromName = config.fromName || fromEmail;
      const tenantId = config.tenantId || 'unknown'; // Ensure tenantId is passed if possible

      if (!host || !user || !pass) {
        throw new Error(`Missing SMTP details: host=${host}, user=${user}`);
      }
      const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,

        auth: {
          user: user,
          pass: pass,
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
      } as any);

      // Use MailService for tracking and logging
      const res = await this.mailService.sendEmailWithTracking(
        transporter,
        fromEmail,
        payload.to,
        payload.subject,
        payload.html || payload.text || '',
        tenantId, // Using tenantId as companyId for logging
        'SMTP',
        fromName,
        config.replyTo || fromEmail
      );

      return res?.data; // Return the log object
    } catch (error) {
      this.logger.error(`Failed to send email to: ${payload.to}`);

      if (error.message.includes('534-5.7.9')) {
        this.logger.error('CRITICAL: Google "WebLoginRequired" detected.');
        this.logger.error('FIX: You MUST use a Google "App Password", not your normal password.');
        this.logger.error('GENERATE HERE: https://myaccount.google.com/apppasswords');
      } else {
        this.logger.error(`Error details: ${error.message}`);
      }

      throw error;
    }
  }
}