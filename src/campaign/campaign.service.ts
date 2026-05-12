import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';
import { MailService } from '../mail/mail.service';
import { User, UserDocument } from '../auth/schemas/user.schema';
import * as nodemailer from 'nodemailer';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectModel(Campaign.name) private campaignModel: Model<CampaignDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mailService: MailService,
  ) { }

  async parseCSVHeaders(buffer: Buffer): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const stream = Readable.from(buffer);
      stream
        .pipe((csv as any)())
        .on('headers', (headers) => {
          resolve(headers);
        })
        .on('error', (err) => reject(err));
    });
  }

  async parseCSVData(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer);
      stream
        .pipe((csv as any)())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  }

  replaceVariables(template: string, data: any, signature?: string): string {
    if (!template) return '';
    let result = template;

    // 1. Handle Signature (%signature% placeholder)
    if (signature) {
      if (result.includes('%signature%')) {
        result = result.replace(/%signature%/g, signature);
      } else {
        // If %signature% placeholder is NOT used, append it to the end (Image 3 logic)
        result += `\n\n${signature}`;
      }
    } else {
      // Remove placeholder if no signature is provided
      result = result.replace(/%signature%/g, '');
    }

    // 2. Automatically match any {{Key}} with the corresponding column in the CSV data
    for (const [key, value] of Object.entries(data)) {
      // Create a case-insensitive regex for the key
      const regex = new RegExp(`{{${key}}}`, 'gi');
      result = result.replace(regex, value?.toString() || '');
    }
    return result;
  }

  async startCampaign(campaignId: string, smtpConfig: any | any[]) {
    const campaign = await this.campaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    // Fetch user for signature fallback
    let signature = campaign.signature;
    if (!signature) {
      const user = await this.userModel.findById(campaign.userId);
      signature = user?.signature || '';
    }

    campaign.status = 'SENDING';
    await campaign.save();

    const configs = Array.isArray(smtpConfig) ? smtpConfig : [smtpConfig];
    const transporters = configs.map(cfg => nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      family: 4,
      debug: true,
      logger: true,
    } as any));

    const emailColumn = campaign.mapping['email'] || 'Email';
    let currentSmtpIndex = 0;

    for (const lead of campaign.leads) {
      const recipientEmail = lead[emailColumn];
      if (!recipientEmail) continue;

      const personalizedSubject = this.replaceVariables(campaign.template.subject, lead, signature);
      const personalizedBody = this.replaceVariables(campaign.template.body, lead, signature);

      const cfg = configs[currentSmtpIndex % configs.length];
      const transporter = transporters[currentSmtpIndex % transporters.length];

      try {
        await this.mailService.sendEmailWithTracking(
          transporter,
          cfg.user,
          recipientEmail,
          personalizedSubject,
          personalizedBody,
          campaign.companyId,
        );
        
        currentSmtpIndex++;
        
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        this.logger.error(`Failed to send campaign email to ${recipientEmail}: ${error.message}`);
      }

      // Always wait
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    campaign.status = 'SENT';
    await campaign.save();
  }

  async createCampaign(data: any) {
    try {
      const campaign = await this.campaignModel.create(data);
      return new CustomResponse(201, 'Campaign created successfully', campaign);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async getCampaigns(companyId: string) {
    try {
      const data = await this.campaignModel.find({ companyId }).sort({ createdAt: -1 });
      return new CustomResponse(200, 'Campaigns fetched successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async getCampaign(id: string, companyId: string) {
    try {
      const data = await this.campaignModel.findOne({ _id: id, companyId });
      if (!data) throw new Error('Campaign not found');
      return new CustomResponse(200, 'Campaign fetched successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 404, error.message));
    }
  }

  // Wrapped for standard variables
  getStandardVariables() {
    const data = [
      { id: 'company_name', label: 'Company Name' },
      { id: 'owner_name', label: 'Owner Name' },
      { id: 'email', label: 'Email' },
    ];
    return new CustomResponse(200, 'Standard variables fetched', data);
  }
}
