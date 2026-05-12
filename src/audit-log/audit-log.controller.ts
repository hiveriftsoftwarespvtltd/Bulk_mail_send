import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('audit-log')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('dashboard')
  async getDashboardData(@Request() req: any, @Query('limit') limitStr: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.auditLogService.getDashboardData(req.user.companyId, limit);
  }
}
