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
  ) { }

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

      const skip = Math.max(0, (page - 1)) * limit;
      const logs = await this.emailLogModel
        .find({
          smtpEmail: email,
          companyId: companyId,
          campaignId: { $exists: true, $ne: null }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      this.logger.log(`📊 [SENT] Found ${logs.length} logs for this company/email`);
      const total = await this.emailLogModel.countDocuments({
        smtpEmail: email,
        companyId: companyId,
        campaignId: { $exists: true, $ne: null }
      });

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

    // ── GMAIL AUTO-ROUTING (Bypass IMAP) ──────────────────────────────────────
    // If the email is Gmail, try to use Gmail API (OAuth) instead of IMAP
    if (account.fromEmail?.toLowerCase().endsWith('@gmail.com')) {
      const oauthAccount = await this.googleMailModel.findOne({
        email: account.fromEmail,
        tenantId: account.tenantId
      });

      if (oauthAccount) {
        this.logger.log(`🚀 [GMAIL] Routing ${account.fromEmail} via Gmail API instead of IMAP`);
        return this.getGoogleReplies(oauthAccount, targetMessageId);
      }

      this.logger.warn(`⚠️ [GMAIL] ${account.fromEmail} is a Gmail account but no OAuth credentials found. Falling back to IMAP (expect failure if App Password is missing).`);
    }

    // ── Resolve IMAP host & port ──────────────────────────────────────────────
    // Use saved imapHost if user configured it; otherwise derive from smtpHost
    const rawSmtp = account.smtpHost || '';
    let imapHost: string = (account as any).imapHost || '';
    let imapPort: number = (account as any).imapPort || 993;

    if (!imapHost) {
      if (rawSmtp.startsWith('smtp.')) {
        imapHost = rawSmtp.replace('smtp.', 'imap.');
      } else {
        imapHost = rawSmtp; // same host works for many providers (e.g. mail.example.com)
      }
    }

    this.logger.log(`🔄 [IMAP] Resolved host: ${imapHost}:${imapPort} for ${account.fromEmail}`);

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: imapPort === 993,   // 993 = implicit SSL, 143 = STARTTLS
      auth: {
        user: account.userName,
        pass: account.password,
      },
      tls: { rejectUnauthorized: false }, // allow self-signed certs
      logger: false,
    });

    try {
      await client.connect();
      let lock = await client.getMailboxLock('INBOX');
      const replies: any[] = [];

      const sentLogs = await this.emailLogModel.find({
        smtpEmail: account.fromEmail,
        companyId: account.tenantId,
        campaignId: { $exists: true, $ne: null }
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
            // ✅ Update original EmailLog status to REPLIED and increment campaign replied counter
            const targetId = inReplyTo || (references.length > 0 ? references[0] : null);
            if (targetId) {
              const logToUpdate = await this.emailLogModel.findOneAndUpdate(
                {
                  messageId: { $regex: targetId, $options: 'i' },
                  companyId: account.tenantId,
                  status: { $ne: 'REPLIED' }
                },
                { $set: { status: 'REPLIED' } },
                { new: true }
              );

              if (logToUpdate && logToUpdate.campaignId) {
                await this.emailLogModel.db.model('CreateCampaign').updateOne(
                  { _id: logToUpdate.campaignId },
                  { $inc: { replied: 1 } }
                );
                this.logger.log(`📈 Incremented replied counter for campaign: ${logToUpdate.campaignId}`);
              }
            }

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
      this.logger.error(`❌ [IMAP] Failed for ${account.fromEmail} → ${imapHost}:${imapPort} | ${error.message}`);
      if (account.fromEmail?.toLowerCase().endsWith('@gmail.com')) {
        this.logger.error(`   Gmail Fix 1: Enable IMAP → Gmail Settings → Forwarding and POP/IMAP → Enable IMAP`);
        this.logger.error(`   Gmail Fix 2: If 2FA is ON, use an App Password: https://myaccount.google.com/apppasswords`);
      }
      return new CustomResponse(500, `IMAP connection failed for ${account.fromEmail}: ${error.message}. Ensure IMAP is enabled in your email provider settings.`, []);
    }
  }

  private async getGoogleReplies(account: GoogleMailDocument, targetMessageId?: string) {
    const cleanId = (id: string) => id ? id.replace(/[<>]/g, '').trim().toLowerCase() : '';

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET')
    );
    oauth2Client.setCredentials({ refresh_token: account.refreshToken });

    try {
      const { token } = await oauth2Client.getAccessToken();
      if (token) {
        oauth2Client.setCredentials({ access_token: token, refresh_token: account.refreshToken });
        await this.googleMailModel.updateOne(
          { _id: account._id },
          { $set: { accessToken: token } }
        );
      } else {
        oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
      }
    } catch (err) {
      this.logger.error(`Failed to refresh Google token during reply fetch for ${account.email}: ${err.message}`);
      oauth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
      const sentLogs = await this.emailLogModel.find({
        smtpEmail: account.email,
        companyId: account.tenantId,
        campaignId: { $exists: true, $ne: null }
      }).select('messageId').lean();
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

          const findHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

          const subject = findHeader('Subject');
          const from = findHeader('From');
          const date = findHeader('Date');
          const msgId = findHeader('Message-ID');
          const inReplyTo = cleanId(findHeader('In-Reply-To'));
          const referencesRaw = findHeader('References') || '';
          const references = referencesRaw.split(/\s+/).map(ref => cleanId(ref)).filter(id => id.length > 0);

          let isOurReply = false;
          if (targetMessageId) {
            const targetIdClean = cleanId(targetMessageId);
            isOurReply = inReplyTo === targetIdClean || references.includes(targetIdClean);
          } else {
            isOurReply = sentMessageIds.has(inReplyTo) || references.some(ref => sentMessageIds.has(ref));
          }

          if (!isOurReply) return null;

          // ✅ Update original EmailLog status to REPLIED and increment campaign replied counter
          const targetId = inReplyTo || (references.length > 0 ? references[0] : null);
          if (targetId) {
            const logToUpdate = await this.emailLogModel.findOneAndUpdate(
              {
                messageId: { $regex: targetId, $options: 'i' },
                companyId: account.tenantId,
                status: { $ne: 'REPLIED' }
              },
              { $set: { status: 'REPLIED' } },
              { new: true }
            );

            if (logToUpdate && logToUpdate.campaignId) {
              await this.emailLogModel.db.model('CreateCampaign').updateOne(
                { _id: logToUpdate.campaignId },
                { $inc: { replied: 1 } }
              );
              this.logger.log(`📈 Incremented replied counter for campaign: ${logToUpdate.campaignId}`);
            }
          }

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
