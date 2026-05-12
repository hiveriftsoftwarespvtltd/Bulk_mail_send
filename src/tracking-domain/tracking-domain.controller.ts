import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { TrackingDomainService } from './tracking-domain.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTrackingDomainDto } from './dto/create-tracking-domain.dto';

@Controller('tracking-domain')
@UseGuards(JwtAuthGuard)
export class TrackingDomainController {
  constructor(private readonly trackingDomainService: TrackingDomainService) {}

  @Get('generate-cname')
  getGenerateCname() {
    return this.trackingDomainService.getGenerateCname();
  }

  @Post('verify-and-save')
  verifyAndSave(
    @Body() createTrackingDomainDto: CreateTrackingDomainDto,
    @Request() req
  ) {
    const tenantId = req.user.companyId;
    return this.trackingDomainService.verifyAndSave(
      tenantId,
      createTrackingDomainDto.emailAccountId,
      createTrackingDomainDto.domainName,
    );
  }

  @Get()
  findAll(@Request() req) {
    const tenantId = req.user.companyId;
    return this.trackingDomainService.findAll(tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const tenantId = req.user.companyId;
    return this.trackingDomainService.remove(id, tenantId);
  }
}
