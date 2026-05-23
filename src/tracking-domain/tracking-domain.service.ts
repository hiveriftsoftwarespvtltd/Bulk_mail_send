import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrackingDomain, TrackingDomainDocument } from './schemas/tracking-domain.schema';
import CustomResponse from 'src/provider/custom-response.service';
import CustomError from 'src/provider/customer-error.service';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);
const resolveA = promisify(dns.resolve4);

@Injectable()
export class TrackingDomainService {
  private readonly logger = new Logger(TrackingDomainService.name);
  private readonly DEFAULT_CNAME_TARGET = 'mailpipes.online';

  constructor(
    @InjectModel('TrackingDomain') private trackingDomainModel: Model<TrackingDomainDocument>,
  ) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  getGenerateCname() {
    return new CustomResponse(200, 'CNAME details fetched successfully', {
      type: 'CNAME',
      host: 'Your Subdomain (e.g. go)',
      value: this.DEFAULT_CNAME_TARGET,
    });
  }

  async verifyAndSave(tenantId: string, emailAccountId: string, domainName: string) {
    try {
      const aRecords = await resolveA(domainName);
      if (!aRecords || aRecords.length === 0) {
        throw new BadRequestException('Domain verification failed: No A records found');
      }
      const txtRecords = await resolveTxt(domainName);
      const hasVerifiedTxt = txtRecords.some(rec => rec.includes('tracking-verified'));
      if (!hasVerifiedTxt) {
        this.logger?.warn && this.logger.warn(`Domain ${domainName} has no tracking-verified TXT record; proceeding with only A record check.`);
      }
    } catch (e) {
      throw new BadRequestException('Domain verification error: ' + (e.message || e));
    }

    const existingDomain = await this.trackingDomainModel.findOne({ tenantId, domainName });
    if (existingDomain) {
      existingDomain.emailAccountId = emailAccountId;
      existingDomain.verified = true;
      existingDomain.cnameTarget = this.DEFAULT_CNAME_TARGET;
      await existingDomain.save();
      return new CustomResponse(200, 'Domain verified and updated successfully', existingDomain);
    }

    const newDomain = new this.trackingDomainModel({
      tenantId,
      emailAccountId,
      domainName,
      cnameTarget: this.DEFAULT_CNAME_TARGET,
      verified: true
    });

    await newDomain.save();
    return new CustomResponse(201, 'Domain verified and saved successfully', newDomain);
  }

  async findAll(tenantId: string) {
    const domains = await this.trackingDomainModel.find({ tenantId }).exec();
    return new CustomResponse(200, 'Tracking domains fetched successfully', domains);
  }

  async remove(id: string, tenantId: string) {
    const result = await this.trackingDomainModel.findOneAndDelete({ _id: id, tenantId });
    if (!result) {
      throw new CustomError(404, 'Tracking domain not found or unauthorized');
    }
    return new CustomResponse(200, 'Tracking domain deleted successfully', null);
  }


  // New method to test DNS resolution on the server
  async testDns(domainName: string) {
    try {
      const aRecords = await resolveA(domainName);
      const txtRecords = await resolveTxt(domainName);
      return { aRecords, txtRecords };
    } catch (e) {
      throw new BadRequestException('DNS test error: ' + (e.message || e));
    }
  }
}

