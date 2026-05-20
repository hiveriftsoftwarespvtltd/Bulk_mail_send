import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getStats(@Request() req) {
    return this.dashboardService.getStats(req.user.userId, req.user.companyId);
  }

  @Get('graph-stats')
  async getGraphStats(@Request() req, @Query('year') year?: string) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    return this.dashboardService.getGraphStats(req.user.userId, req.user.companyId, parsedYear);
  }
}

