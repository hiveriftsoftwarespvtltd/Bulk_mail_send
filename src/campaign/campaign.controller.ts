import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CampaignService } from './campaign.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('campaign')
@UseGuards(JwtAuthGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSV(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file uploaded' };
    }
    const headers = await this.campaignService.parseCSVHeaders(file.buffer);
    const data = await this.campaignService.parseCSVData(file.buffer);
    return { headers, data };
  }

  @Post('create')
  async createCampaign(@Body() body: any, @Request() req: any) {
    const { name, template, mapping, csvData, smtpConfig, signature } = body;
    const companyId = req.user.companyId;
    const userId = req.user.userId;

    let finalSmtpConfig = smtpConfig;
    if (smtpConfig && smtpConfig.user) {
      const email = smtpConfig.user.toLowerCase();
      if (!smtpConfig.host) {
        if (email.endsWith('@gmail.com')) {
          finalSmtpConfig.host = 'smtp.gmail.com';
          finalSmtpConfig.port = 465;
          finalSmtpConfig.secure = true;
        } else if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com')) {
          finalSmtpConfig.host = 'smtp.office365.com';
          finalSmtpConfig.port = 587;
          finalSmtpConfig.secure = false;
        }
      }
    }

    const campaignResponse = await this.campaignService.createCampaign({
      name,
      template,
      mapping,
      leads: csvData,
      companyId,
      userId,
      signature,
      status: 'DRAFT',
    });

    const campaign = campaignResponse?.data;

    if (finalSmtpConfig) {
      this.campaignService.startCampaign(campaign._id.toString(), finalSmtpConfig)
        .catch(err => console.error('Campaign execution error:', err));
      return { message: 'Campaign created and sending in background...', campaignId: campaign._id };
    }

    return { message: 'Campaign created successfully as draft', campaignId: campaign._id };
  }

  @Post('preview')
  async previewEmail(@Body() body: any, @Request() req: any) {
    const { template, lead, signature } = body;
    const subject = this.campaignService.replaceVariables(template.subject, lead, signature);
    const bodyRendered = this.campaignService.replaceVariables(template.body, lead, signature);

    const snippet = bodyRendered.replace(/<[^>]*>/g, '').substring(0, 100);

    return {
      subject,
      body: bodyRendered,
      inboxPreview: {
        title: subject,
        snippet: snippet
      }
    };
  }

  @Get('variables')
  getVariables() {
    return this.campaignService.getStandardVariables();
  }

  @Get('list')
  async getCampaigns(@Request() req: any) {
    return this.campaignService.getCampaigns(req.user.companyId);
  }

  @Get(':id')
  async getCampaign(@Param('id') id: string, @Request() req: any) {
    return this.campaignService.getCampaign(id, req.user.companyId);
  }
}
