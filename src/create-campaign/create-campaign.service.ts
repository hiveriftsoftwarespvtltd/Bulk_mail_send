import { google } from 'googleapis';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateCampaign, CreateCampaignDocument } from './entities/create-campaign.entity';
import { SmtpSender } from '../smtp-sender/entities/smtp-sender.entity';
import { ScheduleCampaign, ScheduleCampaignDocument } from '../schedule-campaign/entities/schedule-campaign.entity';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';
import { GoogleMail, GoogleMailDocument } from '../google-mail/entities/google-mail.entity';
import { OutlookMail, OutlookMailDocument } from '../outlook-mail/entities/outlook-mail.entity';
import { OutlookMailService } from '../outlook-mail/outlook-mail.service';
import { TrackingDomain, TrackingDomainDocument } from '../tracking-domain/schemas/tracking-domain.schema';
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

/**
 * Returns local date, time, and weekday components for a given timezone and date.
 */
function getLocalDetails(timezone: string, date: Date = new Date()) {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long',
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);
    
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '';

    return {
      weekday: getValue('weekday'),
      year: parseInt(getValue('year'), 10),
      month: parseInt(getValue('month'), 10),
      day: parseInt(getValue('day'), 10),
      hour: parseInt(getValue('hour'), 10),
      minute: parseInt(getValue('minute'), 10),
      second: parseInt(getValue('second'), 10),
    };
  } catch (e) {
    console.error('Error getting local details:', e);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      weekday: days[date.getUTCDay()],
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }
}

/**
 * Computes the exact UTC Date for a given local date string and time string in a specific timezone.
 */
function getScheduledDateInTimezone(dateInput: string | Date, timeStr: string, timezone: string): Date {
  let dateStr = '';
  if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split('T')[0];
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.split('T')[0];
  } else {
    dateStr = new Date().toISOString().split('T')[0];
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (timeStr || '00:00').split(':').map(Number);

  const utcBase = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  let offsetMs = 0;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(utcBase);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart) {
      const match = tzPart.value.match(/GMT([+-]\d+)?(?::(\d+))?/);
      if (match) {
        const [_, signHours, minutes] = match;
        if (signHours) {
          const hours = parseInt(signHours, 10);
          const mins = minutes ? parseInt(minutes, 10) : 0;
          const sign = hours < 0 ? -1 : 1;
          offsetMs = (Math.abs(hours) * 60 + mins) * sign * 60 * 1000;
        }
      }
    }
  } catch (e) {
    console.error('Error calculating timezone offset:', e);
  }

  return new Date(utcBase.getTime() - offsetMs);
}

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
    @InjectModel(OutlookMail.name)
    private outlookMailModel: Model<OutlookMailDocument>,
    @InjectModel('TrackingDomain')
    private trackingDomainModel: Model<TrackingDomainDocument>,
    @InjectQueue('campaign')
    private campaignQueue: Queue,
    private mailService: MailService,
    private configService: ConfigService,
    private outlookMailService: OutlookMailService,
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
        const excludeFields = ['filePath', 'name', 'subject', 'body', 'status', 'trackingDomainId', 'selectedAccountIds', 'smtpAccountId'];

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
        trackingDomainId: dto.trackingDomainId,
        selectedAccountIds: dto.selectedAccountIds || (dto.smtpAccountId ? (Array.isArray(dto.smtpAccountId) ? dto.smtpAccountId : [dto.smtpAccountId]) : []),
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
    const campaignId = obj._id.toString();

    const total = await this.emailLogModel.countDocuments({ companyId: workspaceId, campaignId });
    const opened = await this.emailLogModel.countDocuments({ companyId: workspaceId, campaignId, status: { $in: ['OPENED', 'CLICKED', 'REPLIED'] } });
    const clicked = await this.emailLogModel.countDocuments({ companyId: workspaceId, campaignId, status: 'CLICKED' });
    const replied = await this.emailLogModel.countDocuments({ companyId: workspaceId, campaignId, status: 'REPLIED' });

    // ── DOMAIN BREAKDOWN ──────────────────────────────────────────────────
    // Group logs by the domain part of the sender email
    const domainStats = await this.emailLogModel.aggregate([
      { $match: { campaignId: campaignId, companyId: workspaceId } },
      {
        $project: {
          status: 1,
          domain: { $arrayElemAt: [{ $split: ["$smtpEmail", "@"] }, 1] }
        }
      },
      {
        $group: {
          _id: "$domain",
          totalSent: { $sum: 1 },
          opened: { $sum: { $cond: [{ $in: ["$status", ["OPENED", "CLICKED", "REPLIED"]] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $eq: ["$status", "CLICKED"] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ["$status", "REPLIED"] }, 1, 0] } }
        }
      },
      { $sort: { totalSent: -1 } }
    ]);

    obj.sent = total;
    obj.opened = opened;
    obj.replied = replied;
    obj.clicked = clicked;
    obj.positiveReply = 0;
    obj.bounced = 0;
    obj.senderBounced = 0;
    obj.domainBreakdown = domainStats.map(ds => ({
      domain: ds._id,
      sent: ds.totalSent,
      opened: ds.opened,
      clicked: ds.clicked,
      replied: ds.replied,
      openRate: ds.totalSent > 0 ? ((ds.opened / ds.totalSent) * 100).toFixed(2) : "0.00",
      clickRate: ds.totalSent > 0 ? ((ds.clicked / ds.totalSent) * 100).toFixed(2) : "0.00"
    }));

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
      if (dto.intervalValue !== undefined && dto.intervalUnit !== undefined) {
        const val = parseFloat(dto.intervalValue);
        const unit = dto.intervalUnit;
        if (unit === 'hours') {
          dto.intervalMinutes = val * 60;
        } else if (unit === 'seconds') {
          dto.intervalMinutes = val / 60;
        } else {
          dto.intervalMinutes = val;
        }
      }
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
      await this.releaseLocksForCampaign(id, workspaceId);
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

        return new CustomResponse(200, `Test email sent successfully via SMTP from ${smtpConfig.fromEmail}`, result);
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
        
        return new CustomResponse(200, `Test email sent successfully via Google OAuth from ${googleConfig.email}`, result);
      }

      // 3. Try to find Outlook account
      const outlookQuery = isValidObjectId
        ? { _id: accountId, tenantId: workspaceId }
        : { email: accountId, tenantId: workspaceId };

      const outlookConfig = await this.outlookMailModel.findOne(outlookQuery);

      if (outlookConfig) {
        console.log(`🛠️ Preparing Outlook Test for: ${outlookConfig.email}`);
        const accessToken = await this.outlookMailService.refreshAccessToken(outlookConfig.refreshToken);

        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              subject: mailSubject,
              body: {
                contentType: 'HTML',
                content: mailBody,
              },
              toRecipients: [
                {
                  emailAddress: {
                    address: destinationEmail,
                  },
                },
              ],
            },
            saveToSentItems: 'true'
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Graph API Send Failed: ${response.status} - ${errText}`);
        }

        return new CustomResponse(200, `Test email sent successfully via Outlook from ${outlookConfig.email}`, null);
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
      const campaign = await this.campaignModel.findOne({ _id: id, workspaceId });

      if (!campaign) {
        console.error(`Campaign NOT found: ${id} for workspace: ${workspaceId}`);
        throw new NotFoundException('Campaign not found. Please verify the campaign exists in your workspace.');
      }

      // Determine exact UTC schedule date
      let finalScheduledAt: Date | null = null;
      if (scheduledAt) {
        finalScheduledAt = new Date(scheduledAt);
      } else if (campaign.campaignStartDate) {
        const computedDate = getScheduledDateInTimezone(
          campaign.campaignStartDate,
          campaign.from || '09:00',
          campaign.timezone || 'Asia/Kolkata'
        );
        // Only schedule if it's in the future
        if (computedDate.getTime() > Date.now()) {
          finalScheduledAt = computedDate;
        }
      }

      campaign.scheduledAt = finalScheduledAt as Date;
      campaign.status = finalScheduledAt ? 'SCHEDULED' : 'ACTIVE';

      let finalDelayMinutes = delayMinutes;
      if (!finalDelayMinutes || finalDelayMinutes === 0) {
        if (campaign.intervalMinutes) {
          finalDelayMinutes = campaign.intervalMinutes;
          console.log(`Using campaign schedule interval: ${finalDelayMinutes} minutes.`);
        } else {
          console.log(` No manual delay provided. Searching for saved schedule for userId: ${campaign.userId}...`);
          const savedSchedule = await this.scheduleModel.findOne({ userId: campaign.userId }).sort({ createdAt: -1 });
          if (savedSchedule) {
            finalDelayMinutes = savedSchedule.intervalMinutes;
            console.log(`Found user schedule! Using interval: ${finalDelayMinutes} minutes.`);
          } else {
            console.log(`No schedule found. Using default minor delay.`);
            finalDelayMinutes = 0.05;
          }
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
      const providedIds = Array.isArray(smtpAccountId) ? smtpAccountId : (smtpAccountId ? [smtpAccountId] : []);

      if (providedIds.length > 0 && providedIds[0] !== 'all') {
        // If IDs are provided, use them and SAVE them to the campaign for future resumes
        targetAccountIds = providedIds;
        await this.campaignModel.findByIdAndUpdate(campaign._id, { selectedAccountIds: targetAccountIds });
      } else if (campaign.selectedAccountIds && campaign.selectedAccountIds.length > 0) {
        // If no IDs provided but we HAVE saved IDs, use the saved ones
        console.log(`Using previously selected accounts: ${campaign.selectedAccountIds.length} accounts found.`);
        targetAccountIds = campaign.selectedAccountIds;
      } else {
        // Fallback to all available accounts
        console.log(`No accounts specified and no saved selection. Fetching all available accounts for workspace: ${workspaceId}`);
        const [smtpConfigs, googleConfigs, outlookConfigs] = await Promise.all([
          this.smtpSenderModel.find({ tenantId: workspaceId }),
          this.googleMailModel.find({ tenantId: workspaceId }),
          this.outlookMailModel.find({ tenantId: workspaceId })
        ]);
        targetAccountIds = [
          ...smtpConfigs.map(c => (c as any)._id.toString()),
          ...googleConfigs.map(c => (c as any)._id.toString()),
          ...outlookConfigs.map(c => (c as any)._id.toString())
        ];
      }

      const [smtpConfigs, googleConfigs, outlookConfigs] = await Promise.all([
        this.smtpSenderModel.find({ _id: { $in: targetAccountIds }, tenantId: workspaceId }),
        this.googleMailModel.find({ _id: { $in: targetAccountIds }, tenantId: workspaceId }),
        this.outlookMailModel.find({ _id: { $in: targetAccountIds }, tenantId: workspaceId })
      ]);

      if (smtpConfigs.length === 0 && googleConfigs.length === 0 && outlookConfigs.length === 0) {
        console.error(`❌ No valid SMTP, Google, or Outlook configurations found for IDs: ${targetAccountIds} in workspace: ${workspaceId}`);
        throw new NotFoundException(`No valid sender accounts found. Please ensure you have at least one SMTP, Google, or Outlook account added.`);
      }

      // Get all sender emails for the resolved configurations
      const campaignEmails = [
        ...smtpConfigs.map(c => c.fromEmail),
        ...googleConfigs.map(c => c.email),
        ...outlookConfigs.map(c => c.email),
      ].filter(Boolean);

      // Perform locking/conflict validation
      await this.lockSendersForCampaign(id, campaignEmails, workspaceId);

      console.log(`✅ Found ${smtpConfigs.length} SMTP, ${googleConfigs.length} Google, and ${outlookConfigs.length} Outlook Config(s). Preparing...`);

      let delayMs = 0;
      if (finalScheduledAt) {
        const scheduledTime = finalScheduledAt.getTime();
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
    const [smtpConfigs, googleConfigs, outlookConfigs] = await Promise.all([
      this.smtpSenderModel.find({ _id: { $in: accountIds }, tenantId: workspaceId }).lean(),
      this.googleMailModel.find({ _id: { $in: accountIds }, tenantId: workspaceId }).lean(),
      this.outlookMailModel.find({ _id: { $in: accountIds }, tenantId: workspaceId }).lean()
    ]);

    // Check if any of the campaign's sender emails are currently locked by another campaign
    const campaignEmails = [
      ...smtpConfigs.map(c => c.fromEmail),
      ...googleConfigs.map(c => c.email),
      ...outlookConfigs.map(c => c.email),
    ].filter(Boolean);

    try {
      await this.lockSendersForCampaign(campaignId, campaignEmails, workspaceId);
    } catch (lockError) {
      console.error(`❌ Background Job Lock Collision for campaign ${campaignId}: ${lockError.message}`);
      await this.campaignModel.findByIdAndUpdate(campaignId, { status: 'PAUSED' });
      return;
    }

    // ✅ Resolve Tracking Domain:
    // 1. Try specifically selected domain for this campaign
    // 2. Fallback to first verified domain for workspace
    let trackingDomain: any = null;
    if ((campaign as any).trackingDomainId) {
      trackingDomain = await this.trackingDomainModel.findOne({ 
        _id: (campaign as any).trackingDomainId, 
        tenantId: workspaceId, 
        verified: true 
      }).lean();
    }
   
    if (!trackingDomain) {
      trackingDomain = await this.trackingDomainModel.findOne({ 
        tenantId: workspaceId, 
        verified: true 
      }).lean();
    }

    const customTrackingDomain = trackingDomain?.domainName;
    console.log(`🛠️ Job resolution: Found ${smtpConfigs.length} SMTP, ${googleConfigs.length} Google, and ${outlookConfigs.length} Outlook accounts. Tracking Domain: ${customTrackingDomain || 'Default'}`);

    const accounts: any[] = [];

    // Create Outlook Graph clients (Prioritize Outlook/Google)
    for (const config of outlookConfigs) {
      console.log(`🛠️ Attempting manual token refresh for Outlook: ${config.email}`);
      try {
        const freshToken = await this.outlookMailService.refreshAccessToken(config.refreshToken);
        if (!freshToken) {
          throw new Error('Failed to obtain fresh access token from Microsoft.');
        }

        console.log(`✅ Fresh Access Token obtained for Outlook: ${config.email}`);

        accounts.push({
          config,
          transporter: freshToken, // pass accessToken in place of transporter
          type: 'OUTLOOK',
          fromEmail: config.email,
          fromName: config.name,
          replyTo: config.email
        });
      } catch (error) {
        console.error(`❌ Outlook Auth Failed for ${config.email}: ${error.message}`);
      }
    }

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

        // Save the fresh token to database to keep the account updated
        await this.googleMailModel.updateOne(
          { _id: config._id },
          { $set: { accessToken: token } }
        );

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
      await this.campaignModel.findByIdAndUpdate(campaignId, { status: 'PAUSED' });
      await this.releaseLocksForCampaign(campaignId, workspaceId);
      return;
    }

    await this.processCampaignSending(campaign, accounts, workspaceId, customTrackingDomain);
  }

  async checkScheduleGuardrails(campaign: any, workspaceId: string): Promise<{ shouldDelay: boolean; delayMs: number }> {
    const timezone = campaign.timezone || 'Asia/Kolkata';
    const now = new Date();
    const local = getLocalDetails(timezone, now);

    // 1. CHECK ALLOWED SENDING DAYS
    const sendDays = campaign.sendDays || [];
    if (sendDays.length > 0 && !sendDays.includes(local.weekday)) {
      console.log(`📅 Today (${local.weekday}) is not an allowed send day for campaign: ${campaign._id}.`);
      let daysToAdd = 1;
      for (let offset = 1; offset <= 7; offset++) {
        const testDate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
        const testLocal = getLocalDetails(timezone, testDate);
        if (sendDays.includes(testLocal.weekday)) {
          daysToAdd = offset;
          break;
        }
      }
      const targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      const targetUtc = getScheduledDateInTimezone(targetDate, campaign.from || '09:00', timezone);
      const delayMs = Math.max(0, targetUtc.getTime() - now.getTime());
      return { shouldDelay: true, delayMs };
    }

    // 2. CHECK DAILY SENDING WINDOW
    const fromTime = campaign.from || '09:00';
    const toTime = campaign.to || '18:00';

    const currentMinutes = local.hour * 60 + local.minute;
    const [fromH, fromM] = fromTime.split(':').map(Number);
    const [toH, toM] = toTime.split(':').map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;

    if (currentMinutes < fromMinutes) {
      const targetUtc = getScheduledDateInTimezone(now, fromTime, timezone);
      const delayMs = Math.max(0, targetUtc.getTime() - now.getTime());
      return { shouldDelay: true, delayMs };
    }

    if (currentMinutes > toMinutes) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const targetUtc = getScheduledDateInTimezone(tomorrow, fromTime, timezone);
      const delayMs = Math.max(0, targetUtc.getTime() - now.getTime());
      return { shouldDelay: true, delayMs };
    }

    // 3. CHECK MAX LEADS PER DAY LIMIT
    const maxLeads = campaign.maxLeadsPerDay || 0;
    if (maxLeads > 0) {
      const startOfTodayUtc = getScheduledDateInTimezone(now, '00:00', timezone);
      const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

      const logsCount = await this.emailLogModel.countDocuments({
        campaignId: campaign._id.toString(),
        companyId: workspaceId,
        createdAt: { $gte: startOfTodayUtc, $lte: endOfTodayUtc }
      });

      if (logsCount >= maxLeads) {
        console.log(`🚫 Campaign exceeded daily limit of ${maxLeads} emails (Sent today: ${logsCount}).`);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const targetUtc = getScheduledDateInTimezone(tomorrow, fromTime, timezone);
        const delayMs = Math.max(0, targetUtc.getTime() - now.getTime());
        return { shouldDelay: true, delayMs };
      }
    }

    return { shouldDelay: false, delayMs: 0 };
  }

  private async processCampaignSending(campaign: any, accounts: any[], workspaceId: string, customDomain?: string) {
    console.log(`🚀 Starting Bulk Send for Campaign: ${campaign.name} (Progress: ${campaign.currentIndex || 0}/${campaign.contacts.length})`);

    // Mark campaign as SENDING when bulk dispatch begins
    const statusUpdate: any = { status: 'SENDING' };
    if (!campaign.startedAt) {
      statusUpdate.startedAt = new Date();
      campaign.startedAt = statusUpdate.startedAt;
    }
    await this.campaignModel.findByIdAndUpdate(campaign._id, statusUpdate);

    let currentAccountIndex = 0;
    const startIndex = campaign.currentIndex || 0;

    for (let i = startIndex; i < campaign.contacts.length; i++) {
      // ✅ CHECK STATUS: If user paused the campaign, stop the loop immediately
      const freshCampaign = await this.campaignModel.findById(campaign._id).lean();
      if (!freshCampaign || (freshCampaign as any).status === 'PAUSED') {
        console.log(`⏸️ Campaign ${campaign._id} has been PAUSED or deleted. Stopping execution at index ${i}.`);
        await this.releaseLocksForCampaign(campaign._id.toString(), workspaceId);
        return;
      }

      // ✅ Validate Schedule Guardrails constraints before sending
      const guard = await this.checkScheduleGuardrails(freshCampaign, workspaceId);
      if (guard.shouldDelay) {
        console.log(`⏳ Campaign ${campaign._id} window closed or limit reached. Delaying for ${guard.delayMs}ms.`);
        await this.campaignModel.findByIdAndUpdate(campaign._id, {
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + guard.delayMs),
          currentIndex: i,
        });
        
        // Re-enqueue Bull job with computed delay
        const jobData = {
          campaignId: campaign._id.toString(),
          accountIds: accounts.map(a => a.config._id.toString()),
          workspaceId,
        };
        try {
          await this.campaignQueue.add('process-campaign', jobData, {
            delay: guard.delayMs,
            removeOnComplete: true,
          });
        } catch (err) {
          // Fallback timer if Redis has issues
          setTimeout(() => {
            this.runCampaignJob(jobData).catch(e => console.error('Fallback delay failed:', e));
          }, guard.delayMs);
        }
        return; // stop execution loop!
      }

      const contact = campaign.contacts[i];
      let currentAccount: any = null;
      try {
        const recipientEmail = contact.email ? contact.email.toString().trim() : '';

        if (!recipientEmail || !recipientEmail.includes('@')) {
          console.error(`⚠️ Skipping Contact: "${recipientEmail}" is not a valid email.`);
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
          replyTo,
          customDomain,
          campaign._id.toString()
        );

        // Update progress in DB
        await this.campaignModel.findByIdAndUpdate(campaign._id, { currentIndex: i + 1 });

        console.log(`✅ [${i+1}/${campaign.contacts.length}] Sent to: ${contact.email}`);
        currentAccountIndex++;
      } catch (error) {
        console.error(`❌ Failed sending to ${contact.email}:`, error.message);
      }

      const delayMs = (campaign.delayMinutes || 0.05) * 60 * 1000;
      if (delayMs > 0 && i < campaign.contacts.length - 1) {
        const remaining = campaign.contacts.length - (i + 1);
        console.log(`⏳ [${i+1}/${campaign.contacts.length}] Waiting ${campaign.delayMinutes}m before next email... (${remaining} remaining)`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Mark campaign as FINISHED once all contacts have been processed
    await this.campaignModel.findByIdAndUpdate(campaign._id, { status: 'FINISHED', finishedAt: new Date() });
    await this.releaseLocksForCampaign(campaign._id.toString(), workspaceId);
    console.log(`🏁 Finished Bulk Send for Campaign: ${campaign.name} → Status set to FINISHED`);
  }

  async pauseCampaign(id: string, workspaceId: string) {
    const campaign = await this.campaignModel.findOneAndUpdate(
      { _id: id, workspaceId },
      { status: 'PAUSED' },
      { returnDocument: 'after' }
    );
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.releaseLocksForCampaign(id, workspaceId);
    return new CustomResponse(200, 'Campaign paused successfully', campaign);
  }

  async resumeCampaign(id: string, workspaceId: string, smtpAccountId?: string | string[]) {
    const campaign = await this.campaignModel.findOne({ _id: id, workspaceId });
    if (!campaign) throw new NotFoundException('Campaign not found');
    
    // Allow resuming if status is PAUSED, ACTIVE, or DRAFT
    const allowedStatuses = ['PAUSED', 'ACTIVE', 'DRAFT'];
    if (!allowedStatuses.includes(campaign.status)) {
      throwException(new CustomError(400, `Cannot resume campaign with status: ${campaign.status}. Use 'Restart' if it is already finished.`));
    }

    // Update status to SENDING
    campaign.status = 'SENDING';
    await campaign.save();

    return this.startCampaign(id, smtpAccountId || [], workspaceId);
  }

  async restartCampaign(id: string, workspaceId: string, smtpAccountId?: string | string[]) {
    const campaign = await this.campaignModel.findOne({ _id: id, workspaceId });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Reset progress
    campaign.currentIndex = 0;
    campaign.status = 'SENDING';
    await campaign.save();

    // Optionally you could delete logs here, but usually it's better to keep history
    // and let the user see the new logs with a fresh campaignId if they wanted a clean slate.
    // For now, we just reset the index.

    return this.startCampaign(id, smtpAccountId || [], workspaceId);
  }

  async lockSendersForCampaign(campaignId: string, emails: string[], tenantId: string) {
    if (!emails || emails.length === 0) return;

    // 1. Check database for active campaigns in the same workspace
    const activeCampaigns = await this.campaignModel.find({
      workspaceId: tenantId,
      _id: { $ne: campaignId },
      status: { $in: ['SENDING', 'ACTIVE', 'SCHEDULED'] },
    });

    for (const activeCampaign of activeCampaigns) {
      // Resolve emails for this active campaign
      let activeEmails: string[] = [];
      const accountIds = activeCampaign.selectedAccountIds || [];
      if (accountIds.length > 0) {
        const [smtp, google, outlook] = await Promise.all([
          this.smtpSenderModel.find({ _id: { $in: accountIds }, tenantId }),
          this.googleMailModel.find({ _id: { $in: accountIds }, tenantId }),
          this.outlookMailModel.find({ _id: { $in: accountIds }, tenantId }),
        ]);
        activeEmails = [
          ...smtp.map(s => s.fromEmail),
          ...google.map(g => g.email),
          ...outlook.map(o => o.email),
        ];
      } else {
        // Uses all workspace accounts
        const [smtp, google, outlook] = await Promise.all([
          this.smtpSenderModel.find({ tenantId }),
          this.googleMailModel.find({ tenantId }),
          this.outlookMailModel.find({ tenantId }),
        ]);
        activeEmails = [
          ...smtp.map(s => s.fromEmail),
          ...google.map(g => g.email),
          ...outlook.map(o => o.email),
        ];
      }

      const conflict = emails.some(email => activeEmails.includes(email));
      if (conflict) {
        throw new CustomError(
          400,
          'A campaign is already running using this email account. Please wait until the current campaign finishes or stop it before starting another.'
        );
      }
    }

    // 2. Check/Set Redis Locks
    const redisClient = (this.campaignQueue as any).client;
    if (redisClient && redisClient.status === 'ready') {
      for (const email of emails) {
        const lockKey = `lock:sender:${email}`;
        const currentLock = await redisClient.get(lockKey);
        if (currentLock && currentLock !== campaignId.toString()) {
          throw new CustomError(
            400,
            'A campaign is already running using this email account. Please wait until the current campaign finishes or stop it before starting another.'
          );
        }
      }

      // If all clear, set locks in Redis
      for (const email of emails) {
        const lockKey = `lock:sender:${email}`;
        await redisClient.set(lockKey, campaignId.toString());
      }
    }
  }

  async releaseLocksForCampaign(campaignId: string, tenantId: string) {
    try {
      const campaign = await this.campaignModel.findOne({ _id: campaignId, workspaceId: tenantId });
      if (!campaign) return;

      // Find all emails linked to this campaign
      let emails: string[] = [];
      const accountIds = campaign.selectedAccountIds || [];
      if (accountIds.length > 0) {
        const [smtp, google, outlook] = await Promise.all([
          this.smtpSenderModel.find({ _id: { $in: accountIds }, tenantId }),
          this.googleMailModel.find({ _id: { $in: accountIds }, tenantId }),
          this.outlookMailModel.find({ _id: { $in: accountIds }, tenantId }),
        ]);
        emails = [
          ...smtp.map(s => s.fromEmail),
          ...google.map(g => g.email),
          ...outlook.map(o => o.email),
        ];
      } else {
        const [smtp, google, outlook] = await Promise.all([
          this.smtpSenderModel.find({ tenantId }),
          this.googleMailModel.find({ tenantId }),
          this.outlookMailModel.find({ tenantId }),
        ]);
        emails = [
          ...smtp.map(s => s.fromEmail),
          ...google.map(g => g.email),
          ...outlook.map(o => o.email),
        ];
      }

      const redisClient = (this.campaignQueue as any).client;
      if (redisClient && redisClient.status === 'ready') {
        for (const email of emails) {
          const lockKey = `lock:sender:${email}`;
          const currentLock = await redisClient.get(lockKey);
          if (currentLock === campaignId.toString()) {
            await redisClient.del(lockKey);
            console.log(`🔓 Released Redis lock for sender: ${email}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error releasing locks for campaign ${campaignId}:`, error);
    }
  }
}