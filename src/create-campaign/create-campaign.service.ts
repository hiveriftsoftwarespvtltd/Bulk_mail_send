import { google } from 'googleapis';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateCampaign, CreateCampaignDocument } from './entities/create-campaign.entity';
import { SmtpSender } from '../smtp-sender/entities/smtp-sender.entity';
import { ScheduleCampaign, ScheduleCampaignDocument } from '../schedule-campaign/entities/schedule-campaign.entity';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';
import { GoogleMail, GoogleMailDocument } from '../google-mail/entities/google-mail.entity';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';
import { MailService } from '../mail/mail.service';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
const csv = require('csv-parser');

@Injectable()
export class CreateCampaignService {
  constructor(
    @InjectModel(CreateCampaign.name)
    private campaignModel: Model<CreateCampaignDocument>,
    @InjectModel(SmtpSender.name)
    private smtpSenderModel: Model<SmtpSender>,
    @InjectModel(EmailLog.name)
    private emailLogModel: Model<EmailLogDocument>,
    @InjectModel(ScheduleCampaign.name)
    private scheduleModel: Model<ScheduleCampaignDocument>,
    @InjectModel(GoogleMail.name)
    private googleMailModel: Model<GoogleMailDocument>,
    @InjectQueue('campaign')
    private campaignQueue: Queue,
    private mailService: MailService,
    private configService: ConfigService,
  ) { }

  // ✅ BUILT-IN ROBUST PATH RESOLVER
  async parseCSV(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];

      // 1. Get only the filename if a path was provided
      const fileName = path.basename(filePath);

      // 2. Always look inside the 'uploads' folder relative to project root
      const fullPath = path.join(process.cwd(), 'uploads', fileName);

      console.log('📂 Attempting to read file at:', fullPath);

      if (!fs.existsSync(fullPath)) {
        console.error(' File NOT found at:', fullPath);
        return reject(new NotFoundException(`File not found. Checked: ${fullPath}`));
      }

      fs.createReadStream(fullPath)
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', () => {
          console.log(` Successfully parsed ${results.length} rows.`);
          resolve(results);
        })
        .on('error', (error: any) => {
          console.error(' Error parsing CSV:', error);
          reject(error);
        });
    });
  }

  async uploadCSV(file: Express.Multer.File) {
    try {
      const data = await this.parseCSV(file.path);
      const result = {
        filePath: file.path,
        fileName: file.filename,
        columns: Object.keys(data[0] || {}),
      };
      return new CustomResponse(200, 'CSV uploaded and parsed successfully', result);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async mapFields(dto: any) {
    try {
      // Return everything provided in the DTO to allow dynamic mapping
      return new CustomResponse(200, 'Fields mapped successfully', dto);
    } catch (error) {
      throwException(new CustomError(500, error.message));
    }
  }

  async createFinalCampaign(dto: any, userId: string, workspaceId: string) {
    try {
      const data = await this.parseCSV(dto.filePath);

      const mappedContacts = data.map((row: any) => {
        const contact: any = {};

        // Dynamic mapping based on whatever fields were sent in the DTO
        // We exclude known non-mapping fields like filePath, name, subject, body, etc.
        const excludeFields = ['filePath', 'name', 'subject', 'body', 'status'];

        for (const [key, csvColumn] of Object.entries(dto)) {
          if (!excludeFields.includes(key) && typeof csvColumn === 'string') {
            contact[key] = row[csvColumn];
          }
        }

        // Ensure email is always present (compatibility with old emailField or new email)
        contact.email = row[dto.emailField] || row[dto.email] || row['Email'];

        return contact;
      });

      const campaign = await this.campaignModel.create({
        userId,
        workspaceId,
        name: dto.name || 'Untitled Campaign',
        subject: dto.subject,
        body: dto.body,
        status: dto.status || 'ACTIVE',
        contacts: mappedContacts,
        // Save the mapping for reference
        mapping: dto
      });

      const result = {
        totalContacts: mappedContacts.length,
        campaign,
      };

      return new CustomResponse(201, 'Campaign created successfully', result);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  private async integrateDynamicStats(campaign: any, workspaceId: string) {
    const obj = campaign.toObject ? campaign.toObject() : { ...campaign };
    const total = await this.emailLogModel.countDocuments({ companyId: workspaceId, subject: obj.subject });
    const opened = await this.emailLogModel.countDocuments({ companyId: workspaceId, subject: obj.subject, status: { $in: ['OPENED', 'CLICKED'] } });
    const clicked = await this.emailLogModel.countDocuments({ companyId: workspaceId, subject: obj.subject, status: 'CLICKED' });

    obj.sent = total;
    obj.opened = opened;
    obj.replied = clicked;
    obj.positiveReply = 0;
    obj.bounced = 0;
    obj.senderBounced = 0;

    return obj;
  }

  async findAll(workspaceId: string) {
    try {
      const campaigns = await this.campaignModel.find({ workspaceId }).sort({ createdAt: -1 });

      const campaignsWithStats = await Promise.all(
        campaigns.map(c => this.integrateDynamicStats(c, workspaceId))
      );

      return new CustomResponse(200, 'Campaigns fetched successfully', campaignsWithStats);
    } catch (error) {
      throwException(new CustomError(500, error.message));
    }
  }

  async findOne(id: string, workspaceId: string) {
    try {
      const campaign = await this.campaignModel.findOne({ _id: id, workspaceId });
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      const campaignWithStats = await this.integrateDynamicStats(campaign, workspaceId);

      return new CustomResponse(200, 'Campaign fetched successfully', campaignWithStats);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async update(id: string, workspaceId: string, dto: any) {
    try {
      const campaign = await this.campaignModel.findOneAndUpdate(
        { _id: id, workspaceId },
        dto,
        { returnDocument: 'after' },
      );
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }
      return new CustomResponse(200, 'Campaign updated successfully', campaign);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async remove(id: string, workspaceId: string) {
    try {
      const campaign = await this.campaignModel.findOneAndDelete({ _id: id, workspaceId });
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }
      return new CustomResponse(200, 'Campaign deleted successfully', null);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async sendTestEmail(dto: any, workspaceId: string) {
    try {
      const accountId = dto.smtpAccountId || dto.accountId || dto.id || dto.senderEmail;
      const destinationEmail = dto.testEmail || dto.to || dto.email;
      const mailSubject = dto.subject;
      const mailBody = dto.body || dto.html;

      if (!accountId || !destinationEmail) {
        throw new Error('Account ID/Email and destination email are required');
      }

      if (!mailSubject || !mailBody) {
        throw new Error('Campaign subject and body are required to send a test email.');
      }

      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(accountId);

      // 1. Try to find SMTP account
      const smtpQuery = isValidObjectId
        ? { _id: accountId, tenantId: workspaceId }
        : { fromEmail: accountId, tenantId: workspaceId };

      const smtpConfig = await this.smtpSenderModel.findOne(smtpQuery);

      if (smtpConfig) {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.smtpHost,
          port: smtpConfig.smtpPort,
          secure: smtpConfig.smtpPort === 465,
          auth: {
            user: smtpConfig.userName,
            pass: smtpConfig.password,
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

        const result = await transporter.sendMail({
          from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
          to: destinationEmail,
          subject: mailSubject,
          html: mailBody,
          replyTo: smtpConfig.useCustomReplyTo ? smtpConfig.replyTo : smtpConfig.fromEmail,
        });

        return new CustomResponse(200, 'Test email sent successfully via SMTP', result);
      }

      // 2. Try to find Google account
      const googleQuery = isValidObjectId
        ? { _id: accountId, tenantId: workspaceId }
        : { email: accountId, tenantId: workspaceId };

      const googleConfig = await this.googleMailModel.findOne(googleQuery);

      if (googleConfig) {
        console.log(`🛠️ Preparing Google Test Transporter for: ${googleConfig.email}`);
        console.log(`   - ClientID: ${process.env.GOOGLE_CLIENT_ID ? 'Present' : 'MISSING'}`);
        console.log(`   - RefreshToken: ${googleConfig.refreshToken ? 'Present' : 'MISSING'}`);

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: googleConfig.email,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: googleConfig.refreshToken,
          },
          debug: true,
        } as any);

        const result = await transporter.sendMail({
          from: `"${googleConfig.name}" <${googleConfig.email}>`,
          to: destinationEmail,
          subject: mailSubject,
          html: mailBody,
        });

        return new CustomResponse(200, 'Test email sent successfully via Google OAuth', result);
      }

      throw new NotFoundException(`Account configuration not found for: ${accountId}`);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  private replaceVariables(template: string, contact: any): string {
    if (!template) return '';
    let result = template;

    for (const [key, value] of Object.entries(contact)) {
      const val = value?.toString() || '';

      result = result.replace(new RegExp(`{{${key}}}`, 'gi'), val);

      const normalizedKey = key.replace(/\s+/g, '');
      result = result.replace(new RegExp(`{{${normalizedKey}}}`, 'gi'), val);

      const spacedKey = key.replace(/([A-Z])/g, ' $1').trim();
      result = result.replace(new RegExp(`{{${spacedKey}}}`, 'gi'), val);
    }

    if (contact.email) result = result.replace(/{{email}}/gi, contact.email);
    if (contact.firstName) result = result.replace(/{{firstName}}/gi, contact.firstName);
    if (contact.name) result = result.replace(/{{name}}/gi, contact.name);

    return result;
  }

  async startCampaign(id: string, smtpAccountId: string | string[], workspaceId: string, delayMinutes: number = 0, scheduledAt?: string) {
    console.log(` Attempting to start campaign: ${id} | SMTP Account(s): ${JSON.stringify(smtpAccountId)} | Workspace: ${workspaceId}`);
    try {
      const campaign = await this.campaignModel.findOneAndUpdate(
        { _id: id, workspaceId },
        { scheduledAt: scheduledAt ? new Date(scheduledAt) : null, status: scheduledAt ? 'SCHEDULED' : 'SENDING' },
        { returnDocument: 'after' }
      );

      if (!campaign) {
        console.error(`Campaign NOT found: ${id} for workspace: ${workspaceId}`);
        throw new NotFoundException('Campaign not found. Please verify the campaign exists in your workspace.');
      }
      let finalDelayMinutes = delayMinutes;
      if (!finalDelayMinutes || finalDelayMinutes === 0) {
        console.log(` No manual delay provided. Searching for saved schedule for userId: ${campaign.userId}...`);
        const savedSchedule = await this.scheduleModel.findOne({ userId: campaign.userId }).sort({ createdAt: -1 });
        if (savedSchedule) {
          finalDelayMinutes = savedSchedule.intervalMinutes;
          console.log(`Found schedule! Using interval: ${finalDelayMinutes} minutes.`);
        } else {
          console.log(`No schedule found. Using default minor delay.`);
          finalDelayMinutes = 0.05;
        }
      }

      campaign.delayMinutes = finalDelayMinutes;
      await campaign.save();

      const redisClient = (this.campaignQueue as any).client;
      let useQueue = true;

      if (!redisClient || redisClient.status !== 'ready') {
        console.warn(`⚠️ Redis is NOT ready (status: ${redisClient?.status || 'disconnected'}). Falling back to Sync Mode.`);
        useQueue = false;
      }

      console.log(`✅ Campaign found: ${campaign.name}. Validating sender accounts...`);

      let targetAccountIds: string[] = [];
      if (!smtpAccountId || smtpAccountId === 'all' || (Array.isArray(smtpAccountId) && smtpAccountId.length === 0)) {
        console.log(`No accounts specified. Fetching all available accounts for workspace: ${workspaceId}`);
        const [smtpConfigs, googleConfigs] = await Promise.all([
          this.smtpSenderModel.find({ tenantId: workspaceId }),
          this.googleMailModel.find({ tenantId: workspaceId })
        ]);
        targetAccountIds = [
          ...smtpConfigs.map(c => (c as any)._id.toString()),
          ...googleConfigs.map(c => (c as any)._id.toString())
        ];
      } else {
        targetAccountIds = Array.isArray(smtpAccountId) ? smtpAccountId : [smtpAccountId];
      }

      const [smtpConfigs, googleConfigs] = await Promise.all([
        this.smtpSenderModel.find({ _id: { $in: targetAccountIds }, tenantId: workspaceId }),
        this.googleMailModel.find({ _id: { $in: targetAccountIds }, tenantId: workspaceId })
      ]);

      if (smtpConfigs.length === 0 && googleConfigs.length === 0) {
        console.error(`❌ No valid SMTP or Google configurations found for IDs: ${targetAccountIds} in workspace: ${workspaceId}`);
        throw new NotFoundException(`No valid sender accounts found. Please ensure you have at least one SMTP or Google account added.`);
      }

      console.log(`✅ Found ${smtpConfigs.length} SMTP and ${googleConfigs.length} Google Config(s). Preparing...`);

      let delayMs = 0;
      if (scheduledAt) {
        const scheduledTime = new Date(scheduledAt).getTime();
        if (isNaN(scheduledTime)) {
          throw new Error('Invalid scheduledAt date format.');
        }
        delayMs = Math.max(0, scheduledTime - Date.now());
      }

      const jobData = {
        campaignId: id,
        accountIds: targetAccountIds,
        workspaceId,
      };

      if (useQueue) {
        console.log(`🚀 Adding job to Redis queue with delay: ${delayMs}ms`);
        try {
          await this.campaignQueue.add('process-campaign', jobData, {
            delay: delayMs,
            removeOnComplete: true,
          });
          console.log(`🎉 Job added successfully to campaign queue.`);
        } catch (queueError) {
          console.error('🔥 Failed to add job to Bull queue:', queueError.message);
          console.log(`🔄 Redis Error. Falling back to setTimeout mode (Delay: ${delayMs}ms).`);
          setTimeout(() => {
            this.runCampaignJob(jobData).catch(err => console.error('Error in fallback job:', err));
          }, delayMs);
        }
      } else {
        console.log(`⚡ Redis offline. Respecting schedule via setTimeout (Delay: ${delayMs}ms).`);
        // Run in the background using setTimeout to respect the delay
        setTimeout(() => {
          this.runCampaignJob(jobData).catch(err => console.error('Error in sync-mode job:', err));
        }, delayMs);
      }

      const message = 'email sent successfully';

      return new CustomResponse(200, message);
    } catch (error) {
      console.error(`🔥 Error in startCampaign:`, error.message);
      if (error instanceof NotFoundException || error.status) {
        throw error;
      }
      throwException(new CustomError(500, error.message));
    }
  }

  // This will be moved to a processor, but for now I'll keep it here and call it from a processor soon
  async runCampaignJob(data: any) {
    console.log(`🛠️ Processor running job for campaign: ${data.campaignId}`);
    const { campaignId, accountIds, workspaceId } = data;
    const campaign = await this.campaignModel.findOne({ _id: campaignId, workspaceId });
    if (!campaign) {
      console.error(`❌ Job Failed: Campaign ${campaignId} not found during processing.`);
      return;
    }

    // Fetch fresh configs from DB
    const [smtpConfigs, googleConfigs] = await Promise.all([
      this.smtpSenderModel.find({ _id: { $in: accountIds }, tenantId: workspaceId }).lean(),
      this.googleMailModel.find({ _id: { $in: accountIds }, tenantId: workspaceId }).lean()
    ]);

    console.log(`🛠️ Job resolution: Found ${smtpConfigs.length} SMTP and ${googleConfigs.length} Google accounts.`);

    const accounts: any[] = [];

    // Create Google OAuth transporters (Prioritize Google)
    for (const config of googleConfigs) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      console.log(`🛠️ Attempting manual token refresh for: ${config.email}`);

      try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: config.refreshToken });
        const { token } = await oauth2Client.getAccessToken();

        if (!token) {
          throw new Error('Failed to obtain fresh access token from Google.');
        }

        console.log(`✅ Fresh Access Token obtained for ${config.email}`);

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: config.email,
            clientId: clientId,
            clientSecret: clientSecret,
            refreshToken: config.refreshToken,
            accessToken: token,
          },
        } as any);

        accounts.push({
          config,
          transporter,
          type: 'GOOGLE',
          fromEmail: config.email,
          fromName: config.name,
          replyTo: config.email
        });
      } catch (error) {
        console.error(`❌ Google Auth Failed for ${config.email}: ${error.message}`);
        // Fallback to old token if refresh fails, though it likely won't work
      }
    }

    // Create SMTP transporters (Only if not already added as Google)
    smtpConfigs.forEach(config => {
      // Check if we already have this email as a Google account
      if (accounts.some(a => a.fromEmail === config.fromEmail)) {
        console.log(`⏭️ Skipping SMTP for ${config.fromEmail} as Google OAuth is available.`);
        return;
      }

      console.log(`🛠️ Using SMTP for: ${config.fromEmail}`);
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
          user: config.userName ? config.userName.trim() : '',
          pass: config.password ? config.password.trim() : '',
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        family: 4,
      } as any);

      accounts.push({
        config,
        transporter,
        type: 'SMTP',
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyTo: config.useCustomReplyTo ? config.replyTo : config.fromEmail
      });
    });

    if (accounts.length === 0) {
      console.error(`❌ Job Failed: No valid accounts could be initialized.`);
      return;
    }

    await this.processCampaignSending(campaign, accounts, workspaceId);
  }

  private async processCampaignSending(campaign: any, accounts: any[], workspaceId: string) {
    console.log(`🚀 Starting Bulk Send for Campaign: ${campaign.name} (${campaign.contacts.length} contacts) using ${accounts.length} accounts`);

    let currentAccountIndex = 0;
    for (const contact of campaign.contacts) {
      let currentAccount: any = null;
      try {
        const recipientEmail = contact.email ? contact.email.toString().trim() : '';

        // ✅ VALIDATION: Ensure the email is valid and contains an '@'
        if (!recipientEmail || !recipientEmail.includes('@')) {
          console.error(`⚠️ Skipping Contact: "${recipientEmail}" is not a valid email. Please check your CSV mapping.`);
          continue;
        }

        currentAccount = accounts[currentAccountIndex % accounts.length];
        const { transporter, type, fromEmail, fromName, replyTo } = currentAccount;

        const personalizedSubject = this.replaceVariables(campaign.subject, contact);
        const personalizedBody = this.replaceVariables(campaign.body, contact);

        await this.mailService.sendEmailWithTracking(
          transporter,
          fromEmail,
          contact.email,
          personalizedSubject,
          personalizedBody,
          workspaceId,
          type,
          fromName,
          replyTo
        );

        console.log(`✅ [${type}: ${fromEmail}] Sent & Logged successfully to: ${contact.email}`);

        currentAccountIndex++;
      } catch (error) {
        let errorMessage = error.message;
        if (errorMessage.includes('535-5.7.8') || errorMessage.includes('BadCredentials')) {
          const fromEmail = currentAccount?.fromEmail || '';
          const type = currentAccount?.type || 'SMTP';

          if (fromEmail.toLowerCase().endsWith('@gmail.com') && type === 'SMTP') {
            console.error(`⚠️  [GMAIL SMTP ERROR]: Google rejected your password. 
👉 FOR GMAIL SMTP: You MUST use an "App Password" (not your regular password).
👉 OR BETTER: Delete this account and add it via "Connect Google Account" (OAuth) for 100% success.`);
          }
          errorMessage = 'SMTP/OAuth Error: Authentication failed. Please check your credentials.';
        }
        console.error(`❌ Failed sending to ${contact.email}:`, errorMessage);
      }

      // Always wait the specified interval, even on failure
      const delayMs = (campaign.delayMinutes || 0.05) * 60 * 1000;
      if (delayMs > 0) {
        console.log(`Waiting ${delayMs}ms before next email...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`🏁 Finished Bulk Send for Campaign: ${campaign.name}`);
  }
}