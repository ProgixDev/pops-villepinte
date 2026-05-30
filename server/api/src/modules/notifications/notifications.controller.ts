import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  NotificationsService,
  type NotifyAudience,
} from './notifications.service';
import { BroadcastDto, RegisterTokenDto } from './dto/broadcast.dto';

// ─── Customer-facing ────────────────────────────────────────────────────────
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notif: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    return this.notif.listForUser(
      user.id,
      limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 30)) : 30,
    );
  }

  @Get('unread-count')
  unread(@CurrentUser() user: { id: string }) {
    return this.notif.unreadCountForUser(user.id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: { id: string }) {
    return this.notif.markAllRead(user.id);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notif.markRead(user.id, id);
  }
}

// ─── Device-token registration (mobile calls this after permission grant) ──
@Controller('profile/device-tokens')
export class DeviceTokensController {
  constructor(private readonly notif: NotificationsService) {}

  @Post()
  register(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterTokenDto,
  ) {
    return this.notif.registerToken(user.id, dto.token, dto.platform);
  }

  @Delete(':token')
  unregister(
    @CurrentUser() user: { id: string },
    @Param('token') token: string,
  ) {
    return this.notif.unregisterToken(user.id, token);
  }
}

// ─── Admin broadcast ──────────────────────────────────────────────────────
@Controller('admin/notifications')
@UseGuards(AdminGuard)
export class AdminNotificationsController {
  constructor(private readonly notif: NotificationsService) {}

  @Post()
  broadcast(@Body() dto: BroadcastDto) {
    const audience = this.resolveAudience(dto);
    return this.notif.notify(audience, {
      title: dto.title,
      body: dto.body,
      notificationKind: 'broadcast',
    });
  }

  private resolveAudience(dto: BroadcastDto): NotifyAudience {
    if (dto.userIds && dto.userIds.length > 0) {
      return { kind: 'user', userIds: dto.userIds };
    }
    if (dto.audience === 'drivers') return { kind: 'drivers' };
    if (dto.audience === 'all') return { kind: 'all' };
    if (dto.tiers && dto.tiers.length > 0) {
      return { kind: 'tier', tiers: dto.tiers };
    }
    throw new BadRequestException(
      'Choisis une audience : tiers, livreurs, userIds, ou "all".',
    );
  }
}
