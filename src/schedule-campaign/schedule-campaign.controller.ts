import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ScheduleCampaignService } from './schedule-campaign.service';
import { CreateScheduleCampaignDto } from './dto/create-schedule-campaign.dto';
import { UpdateScheduleCampaignDto } from './dto/update-schedule-campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('schedule-campaign')
export class ScheduleCampaignController {
  constructor(private readonly scheduleCampaignService: ScheduleCampaignService) {}
  
  @Post()
  create(@Req() req: any, @Body() createScheduleCampaignDto: CreateScheduleCampaignDto) {
    return this.scheduleCampaignService.create(req.user.userId, createScheduleCampaignDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.scheduleCampaignService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.scheduleCampaignService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updateScheduleCampaignDto: UpdateScheduleCampaignDto) {
    return this.scheduleCampaignService.update(id, req.user.userId, updateScheduleCampaignDto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.scheduleCampaignService.delete(id, req.user.userId);
  }
}
