import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Campaign, CampaignDocument } from './entities/campaign-setting.entity';
import { Model } from 'mongoose'
import { CreateCampaignDto } from './dto/create-campaign-setting.dto';
import { throwException } from 'src/util/util/errorhandling';
import CustomError from 'src/provider/customer-error.service';
import CustomResponse from 'src/provider/custom-response.service';

@Injectable()
export class CampaignSettingsService {
  constructor(
    @InjectModel(Campaign.name)
    private campaignModel: Model<CampaignDocument>,
  ) {}
  async create(createDto: CreateCampaignDto, userId: string) {
    try {
      const campaign = new this.campaignModel({
        ...createDto,
        userId,
      });

      const data = await campaign.save();
      return new CustomResponse(201, 'Campaign setting created successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 400, error.message));
    }
  }

  async findAll(userId: string) {
    try {
      const data = await this.campaignModel.find({ userId });
      return new CustomResponse(200, 'Campaign settings fetched successfully', data);
    } catch (error) {
      throwException(new CustomError(error.status || 500, error.message));
    }
  }
}