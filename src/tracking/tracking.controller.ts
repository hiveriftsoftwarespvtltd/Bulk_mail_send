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

  @Get('open/:id')
  async trackOpen(
    @Param('id') trackingId: string, 
    @Res() res: Response, 
    @Req() req: Request,
    @Ip() ip: string
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const device = this.getDeviceType(userAgent);

    try {
      console.log(` Tracking ID: ${trackingId} | Event: OPENED | Device: ${device} | IP: ${ip}`);
      await this.emailLogModel.updateOne(
        { trackingId, status: { $ne: 'CLICKED' } },
        { 
          $set: { 
            status: 'OPENED', 
            openedAt: new Date(),
            ipAddress: ip,
            device: device
          } 
        }
      );
    } catch (e) {
      console.error('Error tracking open:', e);
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

    try {
      console.log(` Tracking ID: ${trackingId} | Event: CLICKED | Target: ${targetUrl} | Device: ${device} | IP: ${ip}`);
      await this.emailLogModel.updateOne(
        { trackingId },
        { 
          $set: { 
            status: 'CLICKED', 
            clickedAt: new Date(),
            ipAddress: ip,
            device: device
          } 
        }
      );
    } catch (e) {
      console.error('Error tracking click:', e);
    }

    if (targetUrl) {
      return res.redirect(targetUrl);
    }
    return res.send('No target URL provided');
  }
}
