import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCampaign, CreateCampaignDocument } from '../create-campaign/entities/create-campaign.entity';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';
import { SmtpSender, SmtpSenderDocument } from '../smtp-sender/entities/smtp-sender.entity';
import { User, UserDocument } from '../auth/schemas/user.schema';
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
      ] = await Promise.all([
        this.userModel.countDocuments({ companyId }),
        this.campaignModel.countDocuments({ workspaceId: companyId }),
        this.campaignModel.aggregate([
          { $match: { workspaceId: companyId } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        this.emailLogModel.countDocuments({ companyId }),
        this.emailLogModel.countDocuments({ companyId, status: { $in: ['OPENED', 'CLICKED'] } }),
        this.emailLogModel.countDocuments({ companyId, status: 'CLICKED' }),
        this.smtpSenderModel.countDocuments({ tenantId: companyId }),
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
          deliveryRate: totalEmails > 0 ? '100.00' : '0.00',
          openRate: totalEmails > 0 ? ((openedEmails / totalEmails) * 100).toFixed(2) : '0.00',
          clickRate: totalEmails > 0 ? ((clickedEmails / totalEmails) * 100).toFixed(2) : '0.00',
        },

        smtp: {
          totalConfigured: totalSmtp,
        },
      };

      return new CustomResponse(200, 'Dashboard statistics fetched successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }
}
