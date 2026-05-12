// schedule-campaign.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScheduleCampaignService } from './schedule-campaign.service';
import { CreateScheduleCampaignDto } from './dto/create-schedule-campaign.dto';
import { UpdateScheduleCampaignDto } from './dto/update-schedule-campaign.dto';
import { AuthGuard } from '@nestjs/passport';
@Controller('schedule-campaign')
@UseGuards(AuthGuard)
export class ScheduleCampaignController {
  constructor(private readonly service: ScheduleCampaignService) {}

  @Put(':id')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleCampaignDto,
  ) {
    return this.service.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  delete(@Req() req, @Param('id') id: string) {
    return this.service.delete(id, req.user.userId);
  }
}