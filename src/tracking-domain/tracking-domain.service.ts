import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrackingDomain, TrackingDomainDocument } from './schemas/tracking-domain.schema';
import CustomResponse from 'src/provider/custom-response.service';
import CustomError from 'src/provider/customer-error.service';
import * as dns from 'dns';

@Injectable()
export class TrackingDomainService {
  // Default CNAME target the user should point to.
  // Can be configured in .env as well.
  private readonly DEFAULT_CNAME_TARGET = 'track.bulkmail.com';

  constructor(
    @InjectModel(TrackingDomain.name) private trackingDomainModel: Model<TrackingDomainDocument>,
  ) {}

  getGenerateCname() {
    return new CustomResponse(200, 'CNAME details fetched successfully', {
      type: 'CNAME',
      host: 'Your Subdomain (e.g. go)',
      value: this.DEFAULT_CNAME_TARGET,
    });
  }

  async verifyAndSave(tenantId: string, emailAccountId: string, domainName: string) {
    // 1. Verify DNS
    let isVerified = false;
    try {
      const records = await dns.promises.resolveCname(domainName);
      if (records && records.length > 0) {
        // Checking if the resolved CNAME points to our target
        const matchesTarget = records.some(record => record.toLowerCase() === this.DEFAULT_CNAME_TARGET.toLowerCase());
        if (matchesTarget) {
          isVerified = true;
        }
      }
    } catch (error) {
      console.log(`DNS resolution failed for ${domainName}:`, error.message);
      // DNS record doesn't exist or isn't a CNAME
      isVerified = false;
    }

    if (!isVerified) {
      throw new CustomError(400, `DNS Verification Failed. Please ensure you have added a CNAME record for '${domainName}' pointing to '${this.DEFAULT_CNAME_TARGET}' and wait for DNS propagation.`);
    }

    // 2. Save to DB
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
}
