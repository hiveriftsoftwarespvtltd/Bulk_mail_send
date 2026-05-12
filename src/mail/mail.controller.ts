import { Body, Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    @InjectModel(EmailLog.name) private emailLogModel: Model<EmailLogDocument>,
  ) {}

  @Post('send')
  async sendMail(@Body() body: any, @Request() req: any) {
    console.log('RECV /mail/send:', JSON.stringify(body, null, 2));
    const { smtpConfig, smtpConfigs, recipients, subject, message } = body;
    const companyId = req.user?.companyId || 'default-company-id';
    
    // Support both single and multiple configs
    const rawConfigs = smtpConfigs || (smtpConfig ? [smtpConfig] : []);
    
    if (rawConfigs.length === 0) {
      throw new Error('No SMTP configuration provided.');
    }

    const finalConfigs = rawConfigs.map(cfg => {
      let host = cfg.host || cfg.smtpHost;
      let port = cfg.port || cfg.smtpPort;
      let user = cfg.user || cfg.userName;
      let pass = cfg.pass || cfg.password;
      let secure = cfg.secure !== undefined ? cfg.secure : (port === 465);

      if (user && !host) {
        const email = user.toLowerCase();
        if (email.endsWith('@gmail.com')) {
          host = 'smtp.gmail.com';
          port = 465;
          secure = true;
        } else if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com')) {
          host = 'smtp.office365.com';
          port = 587;
          secure = false;
        }
      }
      return { ...cfg, host, port, user, pass, secure };
    });

    this.mailService.sendBulkEmails(
      finalConfigs,
      recipients,
      subject,
      message,
      companyId,
    ).then(() => console.log('Bulk sending process completed'))
     .catch(err => console.error(' Bulk send critical error:', err));

    return { message: 'Emails sending in background...' };
  }

  @Get('logs')
  async getLogs(@Request() req: any) {
    const companyId = req.user?.companyId || 'default-company-id';
    return this.emailLogModel.find({ companyId }).sort({ createdAt: -1 }).limit(100);
  }
  @Get('stats')
  async getStats(@Request() req: any) {
    const companyId = req.user?.companyId || 'default-company-id';
    const total = await this.emailLogModel.countDocuments({ companyId });
    const opened = await this.emailLogModel.countDocuments({ companyId, status: { $in: ['OPENED', 'CLICKED'] } });
    const clicked = await this.emailLogModel.countDocuments({ companyId, status: 'CLICKED' });
    
    const openRate = total > 0 ? (opened / total) * 100 : 0;
    const clickRate = total > 0 ? (clicked / total) * 100 : 0;

    return { total, opened, clicked, openRate, clickRate };
  }
}
