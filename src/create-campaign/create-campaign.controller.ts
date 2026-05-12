import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Patch,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateCampaignService } from './create-campaign.service';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateCreateCampaignDto } from './dto/create-create-campaign.dto';

@Controller('create-campaign')
@UseGuards(JwtAuthGuard)
export class CreateCampaignController {
  constructor(private readonly service: CreateCampaignService) { }

  // ✅ STEP 1: CSV UPLOAD
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const fileName = Date.now() + '-' + file.originalname;
          cb(null, fileName);
        },
      }),
    }),
  )
  async uploadCSV(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(' File upload failed. Please ensure you are sending a file with the field name "file".');
    }

    console.log('Uploaded File:', file);

    const data = await this.service.uploadCSV(file);

    return {
      message: 'File uploaded successfully',
      ...data,
    };
  }

  @Post('map')
  async mapFields(@Body() body: any) {
    console.log('MAP BODY:', body);

    return this.service.mapFields(body);
  }

  @Post('create')
  async createCampaign(@Body() body: CreateCreateCampaignDto, @Request() req: any) {
    if (!body || !body.filePath) {
      throw new BadRequestException(' Campaign data or filePath is missing.');
    }

    console.log('CREATE BODY:', body);

    const userId = req.user?.userId || 'default-user-id';
    const workspaceId = req.user?.companyId || 'default-company-id';

    return this.service.createFinalCampaign(body, userId, workspaceId);
  }

  @Post('test-email')
  async sendTestEmail(@Body() body: any, @Request() req: any) {
    console.log('TEST EMAIL BODY:', body);
    const workspaceId = req.user?.companyId || 'default-company-id';
    return this.service.sendTestEmail(body, workspaceId);
  }

  @Post(':id/start')
  async startCampaign(
    @Param('id') id: string,
    @Body() body: { smtpAccountId: string | string[]; delayMinutes?: number; scheduledAt?: string },
    @Request() req: any
  ) {
    const workspaceId = req.user?.companyId || 'default-company-id';
    return this.service.startCampaign(id, body.smtpAccountId, workspaceId, body.delayMinutes, body.scheduledAt);
  }

  @Get()
  async findAll(@Request() req: any) {
    const workspaceId = req.user?.companyId || 'default-company-id';
    return this.service.findAll(workspaceId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const workspaceId = req.user?.companyId || 'default-company-id';
    return this.service.findOne(id, workspaceId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const workspaceId = req.user?.companyId || 'default-company-id';
    return this.service.update(id, workspaceId, body);
  }

  @Patch(':id/name')
  async updateCampaignName(
    @Param('id') id: string,
    @Body() body: { name: string },
    @Request() req: any,
  ) {
    if (!body || !body.name) {
      throw new BadRequestException('Campaign name is required');
    }
    const workspaceId = req.user?.companyId || 'default-company-id';
    return this.service.update(id, workspaceId, { name: body.name });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const workspaceId = req.user?.companyId || 'default-company-id';
    return this.service.remove(id, workspaceId);
  }
}