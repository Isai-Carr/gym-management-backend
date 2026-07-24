import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a notification (Admin)' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('send-email')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Send email notification to user (Admin)' })
  sendEmail(
    @Body('userId') userId: string,
    @Body('subject') subject: string,
    @Body('message') message: string,
  ) {
    return this.notificationsService.sendEmailNotification(userId, subject, message);
  }

  @Post('send-expiration-warning')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Send expiration warnings to clients with memberships expiring in 7 days (Admin)' })
  sendExpirationWarning() {
    return this.notificationsService.sendExpirationWarning();
  }

  @Post('membership-expired')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Alias for send-expiration-warning (Admin)' })
  membershipExpired() {
    return this.notificationsService.sendExpirationWarning();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all notifications (Admin)' })
  findAll(@Query('userId') userId?: string) {
    return this.notificationsService.findAll(userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my notifications' })
  getMyNotifications(@Request() req: any) {
    return this.notificationsService.findUserNotifications(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id, req.user.role === Role.ADMIN);
  }

  @Patch('read-all/me')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
