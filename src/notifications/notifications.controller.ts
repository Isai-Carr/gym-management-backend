import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';

import { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateNotificationDto,
  ) {
    return this.notificationsService.create(dto);
  }

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(
      id,
    );
  }
}