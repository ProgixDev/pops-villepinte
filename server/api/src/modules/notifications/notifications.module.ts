import { Module } from '@nestjs/common';
import {
  AdminNotificationsController,
  DeviceTokensController,
  NotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [
    NotificationsController,
    DeviceTokensController,
    AdminNotificationsController,
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
