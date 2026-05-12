import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CampaignSettingsService } from './campaign-settings.service';
import { CreateCampaignDto } from './dto/create-campaign-setting.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('campaign-settings')
export class CampaignSettingsController {
  constructor(private readonly service: CampaignSettingsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() dto: CreateCampaignDto, @Req() req) {
    const userId = req.user.userId;
    return this.service.create(dto, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(@Req() req) {
    const userId = req.user.userId;
    return this.service.findAll(userId);
  }
} 