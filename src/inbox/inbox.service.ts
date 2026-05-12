import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { EmailLog, EmailLogDocument } from '../logs/schemas/email-log.schema';
import { SmtpSender, SmtpSenderDocument } from '../smtp-sender/entities/smtp-sender.entity';
import { GoogleMail, GoogleMailDocument } from '../google-mail/entities/google-mail.entity';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import CustomResponse from 'src/provider/custom-response.service';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    @InjectModel(EmailLog.name) private emailLogModel: Model<EmailLogDocument>,
    @InjectModel(SmtpSender.name) private smtpSenderModel: Model<SmtpSenderDocument>,
    @InjectModel(GoogleMail.name) private googleMailModel: Model<GoogleMailDocument>,
    private configService: ConfigService,
  ) {}

  async listAllAccounts(companyId: string) {
    try {
      const smtpAccounts = await this.smtpSenderModel.find({ tenantId: companyId }).lean();
      const googleAccounts = await this.googleMailModel.find({ tenantId: companyId }).lean();

      const allAccounts = [
        ...smtpAccounts.map(acc => ({ 
          id: acc._id, 
          email: acc.fromEmail, 
          type: 'SMTP', 
          name: acc.fromName,
          connectedAt: (acc as any).createdAt 
        })),
        ...googleAccounts.map(acc => ({ 
          id: acc._id, 
          email: acc.email, 
          type: 'GOOGLE', 
          name: acc.name,
          connectedAt: (acc as any).createdAt
        })),
      ];

      return new CustomResponse(200, 'Accounts fetched', allAccounts);
    } catch (error) {
      throwException(new CustomError(500, error.message));
    }
  }

  async getSentMails(accountId: string, companyId: string, page: number, limit: number) {
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      throw new BadRequestException('Invalid Account ID format');
    }

    try {
      let email = '';
      const smtpAcc = await this.smtpSenderModel.findOne({ _id: accountId, tenantId: companyId });
      if (smtpAcc) {
        email = smtpAcc.fromEmail;
      } else {
        const googleAcc = await this.googleMailModel.findOne({ _id: accountId, tenantId: companyId });
        if (googleAcc) {
          email = googleAcc.email;
        }
      }

      if (!email) throw new NotFoundException('Account not found');

      this.logger.log(`🔍 [SENT] Fetching logs for email: ${email}, companyId: ${companyId}`);

      const skip = (page - 1) * limit;
      const logs = await this.emailLogModel
        .find({ smtpEmail: email, companyId: companyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      this.logger.log(`📊 [SENT] Found ${logs.length} logs for this company/email`);
      const total = await this.emailLogModel.countDocuments({ smtpEmail: email, companyId: companyId });

      return new CustomResponse(200, 'Sent mails fetched', { logs, total, page, limit });
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }

  async getReplies(accountId: string, companyId: string, messageId: string) {
    const smtpAcc = await this.smtpSenderModel.findOne({ _id: accountId, tenantId: companyId });
    if (smtpAcc) return this.getSmtpReplies(smtpAcc, messageId);

    const googleAcc = await this.googleMailModel.findOne({ _id: accountId, tenantId: companyId });
    if (googleAcc) return this.getGoogleReplies(googleAcc, messageId);

    throw new NotFoundException('Account not found');
  }

  async getAllRecentReplies(accountId: string, companyId: string) {
    const smtpAcc = await this.smtpSenderModel.findOne({ _id: accountId, tenantId: companyId });
    if (smtpAcc) return this.getSmtpReplies(smtpAcc);

    const googleAcc = await this.googleMailModel.findOne({ _id: accountId, tenantId: companyId });
    if (googleAcc) return this.getGoogleReplies(googleAcc);

    throw new NotFoundException('Account not found');
  }

  async getGlobalReplies(companyId: string) {
    try {
      const smtpAccounts = await this.smtpSenderModel.find({ tenantId: companyId });
      const googleAccounts = await this.googleMailModel.find({ tenantId: companyId });

      const allReplies: any[] = [];

      for (const acc of smtpAccounts) {
        const res: any = await this.getSmtpReplies(acc);
        if (res.statusCode === 200) {
          allReplies.push(...res.data.map(r => ({ ...r, accountEmail: acc.fromEmail, accountType: 'SMTP', accountId: acc._id })));
        }
      }

      for (const acc of googleAccounts) {
        const res: any = await this.getGoogleReplies(acc);
        if (res.statusCode === 200) {
          allReplies.push(...res.data.map(r => ({ ...r, accountEmail: acc.email, accountType: 'GOOGLE', accountId: acc._id })));
        }
      }

      const sorted = allReplies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return new CustomResponse(200, 'Global replies fetched', sorted);
    } catch (error) {
      return new CustomResponse(500, error.message, []);
    }
  }

  async getThread(accountId: string, companyId: string, messageId: string) {
    try {
      const originalMail = await this.emailLogModel.findOne({ 
        messageId: { $regex: messageId.replace(/[<>]/g, ''), $options: 'i' }, 
        companyId 
      }).lean();

      let repliesRes: any;
      const smtpAcc = await this.smtpSenderModel.findOne({ _id: accountId, tenantId: companyId });
      if (smtpAcc) {
        repliesRes = await this.getSmtpReplies(smtpAcc, messageId);
      } else {
        const googleAcc = await this.googleMailModel.findOne({ _id: accountId, tenantId: companyId });
        if (googleAcc) {
          repliesRes = await this.getGoogleReplies(googleAcc, messageId);
        }
      }

      return new CustomResponse(200, 'Thread fetched', {
        original: originalMail,
        replies: repliesRes ? repliesRes.data : []
      });
    } catch (error) {
      throwException(new CustomError(500, error.message));
    }
  }

  private async getSmtpReplies(account: SmtpSenderDocument, targetMessageId?: string) {
    const cleanId = (id: string) => id ? id.replace(/[<>]/g, '').trim().toLowerCase() : '';
    
    this.logger.log(`🔄 [IMAP] Connecting to ${account.smtpHost.replace('smtp.', 'imap.')} for ${account.fromEmail}...`);

    const client = new ImapFlow({
      host: account.smtpHost.replace('smtp.', 'imap.'),
      port: 993,
      secure: true,
      auth: {
        user: account.userName,
        pass: account.password,
      },
      logger: false,
    });

    try {
      await client.connect();
      let lock = await client.getMailboxLock('INBOX');
      const replies: any[] = [];

      const sentLogs = await this.emailLogModel.find({ 
        smtpEmail: account.fromEmail, 
        companyId: account.tenantId 
      }).select('messageId').lean();
      
      const sentMessageIds = new Set(sentLogs.map(log => cleanId(log.messageId)));

      try {
        const mailbox = (client as any).mailbox;
        const totalMessages = mailbox ? mailbox.exists : 0;
        const start = Math.max(1, totalMessages - 100);
        const range = totalMessages > 0 ? `${start}:*` : '1:*';

        for await (let msg of client.fetch(range, { envelope: true, source: true })) {
           if (!msg.source) continue;
           const parsed: any = await simpleParser(msg.source);
           const inReplyTo = cleanId(parsed.inReplyTo);
           const references = (Array.isArray(parsed.references) ? parsed.references : [parsed.references || ''])
             .map(ref => cleanId(ref));

           let isOurReply = false;
           if (targetMessageId) {
             const targetIdClean = cleanId(targetMessageId);
             isOurReply = inReplyTo === targetIdClean || references.includes(targetIdClean);
           } else {
             isOurReply = sentMessageIds.has(inReplyTo) || references.some(ref => sentMessageIds.has(ref));
           }

           if (isOurReply) {
             replies.push({
               subject: parsed.subject,
               from: parsed.from?.text,
               date: parsed.date,
               text: parsed.text,
               html: parsed.html,
               messageId: parsed.messageId,
               inReplyTo: parsed.inReplyTo
             });
           }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      return new CustomResponse(200, 'Replies fetched', replies.sort((a, b) => b.date - a.date));
    } catch (error) {
      this.logger.error(`❌ [IMAP] Error for ${account.fromEmail}: ${error.message}`);
      return new CustomResponse(500, `Could not connect to IMAP: ${error.message}`, []);
    }
  }

  private async getGoogleReplies(account: GoogleMailDocument, targetMessageId?: string) {
    const cleanId = (id: string) => id ? id.replace(/[<>]/g, '').trim().toLowerCase() : '';
    
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET')
    );
    oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
      const sentLogs = await this.emailLogModel.find({ smtpEmail: account.email, companyId: account.tenantId }).select('messageId').lean();
      const sentMessageIds = new Set(sentLogs.map(log => cleanId(log.messageId)));

      const query = targetMessageId ? `rfc822msgid:${targetMessageId}` : 'is:inbox';
      const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 });
      const messages = res.data.messages || [];

      const detailedMessages = await Promise.all(
        messages.map(async (m) => {
          if (!m.id) return null;
          const detail: any = await gmail.users.messages.get({ userId: 'me', id: m.id });
          const payload = detail.data.payload;
          if (!payload) return null;
          const headers = (payload.headers as any[]) || [];
          
          const subject = headers.find(h => h.name === 'Subject')?.value;
          const from = headers.find(h => h.name === 'From')?.value;
          const date = headers.find(h => h.name === 'Date')?.value;
          const msgId = headers.find(h => h.name === 'Message-ID')?.value;
          const inReplyTo = cleanId(headers.find(h => h.name === 'In-Reply-To')?.value);
          const referencesRaw = headers.find(h => h.name === 'References')?.value || '';
          const references = referencesRaw.split(/\s+/).map(ref => cleanId(ref)).filter(id => id.length > 0);

          let isOurReply = false;
          if (targetMessageId) {
            const targetIdClean = cleanId(targetMessageId);
            isOurReply = inReplyTo === targetIdClean || references.includes(targetIdClean);
          } else {
            isOurReply = sentMessageIds.has(inReplyTo) || references.some(ref => sentMessageIds.has(ref));
          }

          if (!isOurReply) return null;

          return {
            id: m.id,
            threadId: m.threadId,
            subject,
            from,
            date,
            messageId: msgId,
            inReplyTo,
            snippet: detail.data.snippet,
          };
        })
      );

      return new CustomResponse(200, 'Google replies fetched', detailedMessages.filter(m => m !== null));
    } catch (error) {
      return new CustomResponse(500, error.message, []);
    }
  }
}
