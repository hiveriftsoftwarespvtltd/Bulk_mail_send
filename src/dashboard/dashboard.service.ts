import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCampaign, CreateCampaignDocument } from '../create-campaign/entities/create-campaign.entity';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';
import { SmtpSender, SmtpSenderDocument } from '../smtp-sender/entities/smtp-sender.entity';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { GoogleMail, GoogleMailDocument } from '../google-mail/entities/google-mail.entity';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(CreateCampaign.name) private campaignModel: Model<CreateCampaignDocument>,
    @InjectModel(EmailLog.name) private emailLogModel: Model<EmailLogDocument>,
    @InjectModel(SmtpSender.name) private smtpSenderModel: Model<SmtpSenderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(GoogleMail.name) private googleMailModel: Model<GoogleMailDocument>,
  ) { }

  async getStats(userId: string, companyId: string) {
    try {
      const [
        totalUsers,
        totalCampaigns,
        campaignStats,
        totalEmails,
        openedEmails,
        clickedEmails,
        totalSmtp,
        totalGoogle,
        totalReplies,
      ] = await Promise.all([
        this.userModel.countDocuments({ companyId }),
        this.campaignModel.countDocuments({ workspaceId: companyId }),
        this.campaignModel.aggregate([
          { $match: { workspaceId: companyId } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        
        this.emailLogModel.countDocuments({ companyId }),
        this.emailLogModel.countDocuments({ companyId, status: { $in: ['OPENED', 'CLICKED', 'REPLIED'] } }),
        this.emailLogModel.countDocuments({ companyId, status: 'CLICKED' }),
        this.smtpSenderModel.countDocuments({ tenantId: companyId }),
        this.googleMailModel.countDocuments({ tenantId: companyId }),
        this.emailLogModel.countDocuments({ companyId, status: 'REPLIED' }),
      ]);

      const campaignStatusCounts = campaignStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});

      const data = {
        users: {
          total: totalUsers
        },
        campaigns: {
          total: totalCampaigns,
          byStatus: campaignStatusCounts,
        },
        emails: {
          totalSent: totalEmails,
          totalOpened: openedEmails,
          totalClicked: clickedEmails,
          totalReplied: totalReplies,
          deliveryRate: totalEmails > 0 ? '100.00' : '0.00',
          openRate: totalEmails > 0 ? ((openedEmails / totalEmails) * 100).toFixed(2) : '0.00',
          clickRate: totalEmails > 0 ? ((clickedEmails / totalEmails) * 100).toFixed(2) : '0.00',
          replyRate: totalEmails > 0 ? ((totalReplies / totalEmails) * 100).toFixed(2) : '0.00',
        },

        smtp: {
          totalConfigured: totalSmtp + totalGoogle,
          smtpCount: totalSmtp,
          googleCount: totalGoogle,
        },
      };

      return new CustomResponse(200, 'Dashboard statistics fetched successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async getGraphStats(userId: string, companyId: string, year?: number) {
    try {
      const selectedYear = year || new Date().getFullYear();
      const startDate = new Date(`${selectedYear}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${selectedYear}-12-31T23:59:59.999Z`);

      const stats = await this.emailLogModel.aggregate([
        {
          $match: {
            companyId,
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            totalSent: { $sum: 1 },
            totalOpened: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ["$status", ["OPENED", "CLICKED", "REPLIED"]] },
                      { $gt: ["$openedAt", null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            totalClicked: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", "CLICKED"] },
                      { $gt: ["$clickedAt", null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const monthsData = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(0, i).toLocaleString('en-US', { month: 'short' }),
        openRate: "0.00",
        clickRate: "0.00",
        totalSent: 0,
        totalOpened: 0,
        totalClicked: 0
      }));

      stats.forEach(stat => {
        const monthIndex = stat._id - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          const sent = stat.totalSent || 0;
          const opened = stat.totalOpened || 0;
          const clicked = stat.totalClicked || 0;

          monthsData[monthIndex].totalSent = sent;
          monthsData[monthIndex].totalOpened = opened;
          monthsData[monthIndex].totalClicked = clicked;
          monthsData[monthIndex].openRate = sent > 0 ? ((opened / sent) * 100).toFixed(2) : "0.00";
          monthsData[monthIndex].clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(2) : "0.00";
        }
      });

      return new CustomResponse(200, 'Graph statistics fetched successfully', monthsData);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }
}

