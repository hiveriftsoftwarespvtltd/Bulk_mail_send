import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import CustomResponse from 'src/provider/custom-response.service';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import * as os from 'os';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async logAction(
    action: string,
    email: string,
    companyId: string,
    ipAddress: string,
    device: string,
    endpoint: string,
  ) {
    try {
      const log = new this.auditLogModel({
        action,
        email,
        companyId,
        ipAddress,
        device,
        endpoint,
      });
      await log.save();
    } catch (e) {
      console.error('Failed to save audit log:', e.message);
    }
  }

  private getServerNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    return addresses.length > 0 ? addresses.join(', ') : 'localhost / 127.0.0.1';
  }

  async getDashboardData(companyId: string, limit: number = 50) {
    try {
      const totalUsers = await this.userModel.countDocuments({ companyId });
      const recentLogs = await this.auditLogModel.find({ companyId }).sort({ createdAt: -1 }).limit(limit);

      const systemInfo = {
        platform: os.platform(),            // e.g. 'win32', 'linux'
        osType: os.type(),                  // e.g. 'Windows_NT', 'Linux'
        releaseVersion: os.release(),       // e.g. '10.0.x'
        architecture: os.arch(),            // e.g. 'x64'
        hostname: os.hostname(),            // Server PC name
        serverIpAddress: this.getServerNetworkInfo(),
        uptimeSeconds: Math.floor(os.uptime()), 
        totalRamGB: (os.totalmem() / (1024 ** 3)).toFixed(2),
        freeRamGB: (os.freemem() / (1024 ** 3)).toFixed(2),
        cpuCores: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown CPU',
      };

      const dashboardStats = {
        totalUsers,
        systemInfo,
        recentLogs
      };

      return new CustomResponse(200, 'Audit Dashboard fetched successfully', dashboardStats);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }
}
