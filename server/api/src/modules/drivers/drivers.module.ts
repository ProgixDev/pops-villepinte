import { Module } from '@nestjs/common';
import {
  AdminDriversController,
  AdminOrderAssignmentsController,
} from './admin-drivers.controller';
import { DriversService } from './drivers.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminDriversController, AdminOrderAssignmentsController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
