import { Controller, Get, Param, Query, Res, Req, Ip } from '@nestjs/common';
import { Response, Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';

@Controller('track')
export class TrackingController {
  constructor(
    @InjectModel(EmailLog.name) private emailLogModel: Model<EmailLogDocument>,
  ) {}

  private getDeviceType(userAgent: string): string {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera M(obi|ini)/.test(userAgent)) {
      return 'Mobile';
    }
    return 'Desktop/Laptop';
  }

  private isBot(userAgent: string): boolean {
    if (!userAgent) return false;
    const bots = [
      'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'duckduckbot',
      'bot', 'crawler', 'spider', 'scanner', 'headless', 'chrome-lighthouse',
      'gsa-crawler', 'monitoring', 'validator', 'checker',
      'facebookexternalhit', 'twitterbot', 'linkedinbot', 'pinterestbot',
      'slackbot', 'discordbot', 'telegrambot', 'whatsapp', 'preview', 'embedly',
      'headless', 'lighthouse'
    ];
    const ua = userAgent.toLowerCase();
    return bots.some(bot => ua.includes(bot));
  }

  @Get('open/:id')
  async trackOpen(
    @Param('id') trackingId: string, 
    @Res() res: Response, 
    @Req() req: Request,
    @Ip() ip: string
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const device = this.getDeviceType(userAgent);

    if (this.isBot(userAgent)) {
      console.log(` 🤖 Bot Detected (OPEN): ${userAgent} | IP: ${ip} | Skipping...`);
    } else {
      try {
        const log = await this.emailLogModel.findOneAndUpdate(
          { trackingId, status: 'SENT' },
          { 
            $set: { 
              status: 'OPENED', 
              openedAt: new Date(),
              ipAddress: ip,
              device: device
            } 
          },
          { returnDocument: 'after' as any }
        );

        if (log && log.campaignId) {
          // Increment the 'opened' counter in the Campaign table for permanent persistence
          await this.emailLogModel.db.model('CreateCampaign').updateOne(
            { _id: log.campaignId },
            { $inc: { opened: 1 } }
          );
          console.log(`📈 Incremented opened counter for campaign: ${log.campaignId}`);
        }
      } catch (e) {
        console.error('Error tracking open:', e);
      }
    }

    const buf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(buf);
  }

  @Get('click/:id')
  async trackClick(
    @Param('id') trackingId: string,
    @Query('url') targetUrl: string,
    @Res() res: Response,
    @Req() req: Request,
    @Ip() ip: string
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const device = this.getDeviceType(userAgent);

    if (this.isBot(userAgent)) {
      console.log(` 🤖 Bot Detected (CLICK): ${userAgent} | IP: ${ip} | Redirecting without tracking...`);
    } else {
      try {
        console.log(` Tracking ID: ${trackingId} | Event: CLICKED | Target: ${targetUrl} | Device: ${device} | IP: ${ip}`);
        
        const updateData: any = { 
          status: 'CLICKED', 
          clickedAt: new Date(),
          ipAddress: ip,
          device: device
        };

        const log = await this.emailLogModel.findOneAndUpdate(
          { trackingId, status: { $in: ['SENT', 'OPENED'] } },
          { 
            $set: updateData,
            $setOnInsert: { openedAt: new Date() } 
          },
          { returnDocument: 'after' as any }
        );

        // Explicitly set openedAt if it was still SENT
        if (log && !log.openedAt) {
          await this.emailLogModel.updateOne(
            { trackingId },
            { $set: { openedAt: new Date() } }
          );
        }

        if (log && log.campaignId) {
          // Increment the 'clicked' counter in the Campaign table
          await this.emailLogModel.db.model('CreateCampaign').updateOne(
            { _id: log.campaignId },
            { $inc: { clicked: 1 } }
          );
          console.log(`📈 Incremented clicked counter for campaign: ${log.campaignId}`);
        }

      } catch (e) {
        console.error('Error tracking click:', e);
      }
    }

    if (targetUrl) {
      return res.redirect(targetUrl);
    }
    return res.send('No target URL provided');
  }
}
