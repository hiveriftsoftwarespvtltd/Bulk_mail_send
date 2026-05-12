// schedule-campaign.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ScheduleCampaign } from './entities/schedule-campaign.entity';
import { Model } from 'mongoose';
import { CreateScheduleCampaignDto } from './dto/create-schedule-campaign.dto';
import { UpdateScheduleCampaignDto } from './dto/update-schedule-campaign.dto';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';

@Injectable()
export class ScheduleCampaignService {
  constructor(
    @InjectModel(ScheduleCampaign.name)
    private model: Model<ScheduleCampaign>,
  ) {}

  async create(userId: string, dto: CreateScheduleCampaignDto) {
    try {
      const data = {
        userId,
        timezone: dto.timezone,
        sendDays: dto.sendDays,
        timePeriod: {
          from: dto.from,
          to: dto.to,
        },
        intervalMinutes: dto.intervalMinutes,
        campaignStartDate: dto.campaignStartDate,
        maxLeadsPerDay: dto.maxLeadsPerDay,
      };

      const result = await this.model.create(data);
      return new CustomResponse(201, 'Schedule campaign created successfully', result);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async findAll(userId: string) {
    try {
      const data = await this.model.find({ userId }).sort({ createdAt: -1 });
      return new CustomResponse(200, 'Schedule campaigns fetched successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }
  async findOne(id: string, userId: string) {
    try {
      const data = await this.model.findOne({ _id: id, userId });

      if (!data) {
        throw new NotFoundException('Campaign not found');
      }

      return new CustomResponse(200, 'Schedule campaign fetched successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 404, error.message));
    }
  }

  async update(id: string, userId: string, dto: UpdateScheduleCampaignDto) {
    try {
      const updateData: any = {
        timezone: dto.timezone,
        sendDays: dto.sendDays,
        intervalMinutes: dto.intervalMinutes,
        campaignStartDate: dto.campaignStartDate,
        maxLeadsPerDay: dto.maxLeadsPerDay,
      };

      if (dto.from || dto.to) {
        updateData.timePeriod = {
          from: dto.from,
          to: dto.to,
        };
      }

      const updated = await this.model.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        {
          returnDocument: 'after',
        },
      );

      if (!updated) {
        throw new NotFoundException('Update failed or not found');
      }

      return new CustomResponse(200, 'Schedule campaign updated successfully', updated);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async delete(id: string, userId: string) {
    try {
      const deleted = await this.model.deleteOne({ _id: id, userId });

      if (deleted.deletedCount === 0) {
        throw new NotFoundException('Delete failed or not found');
      }

      return new CustomResponse(200, 'Campaign deleted successfully');
    } catch (error) {
      throwException(new CustomError(error.status || 404, error.message));
    }
  }
}