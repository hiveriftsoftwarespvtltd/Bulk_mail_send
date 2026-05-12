import { Controller, Post, Get,Put,Delete, Param, Body, UseGuards, Request,  } from '@nestjs/common';
import { SmtpSenderService } from './smtp-sender.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSmtpSenderDto } from './dto/create-smtp-sender.dto';
import { UpdateSmtpSenderDto } from './dto/update-smtp-sender.dto';
import { SendMailDto } from './dto/send-mail.dto';
import { SendDirectDto } from './dto/send-direct.dto';
  
@Controller('smtp-sender')
@UseGuards(JwtAuthGuard)
export class SmtpSenderController {
  constructor(private readonly service: SmtpSenderService) {}
  @Post()
  create(@Body() body: CreateSmtpSenderDto, @Request() req) {
    return this.service.create(body, req.user.companyId);
  }

  @Get('all-accounts')
  listAllAccounts(@Request() req) {
    return this.service.listAllAccounts(req.user.companyId);
  }

  @Get()
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }
  
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }
  
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateSmtpSenderDto,
    @Request() req,
  ) {
    return this.service.update(id, body, req.user.companyId);
  }
 
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.service.delete(id, req.user.companyId);
  }
  
  @Post(':id/send')
  sendMail(
    @Param('id') id: string,
    @Body() body: SendMailDto,
    @Request() req,
  ) {
    return this.service.sendMail(id, req.user.companyId, body);
  }
  
  @Post('send-direct')
  sendMailDirect(@Body() body: SendDirectDto) {
    return this.service.sendMailDirect(body);
  }
}