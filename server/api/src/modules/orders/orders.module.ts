import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersAdminController } from './orders-admin.controller';
import { OrdersService } from './orders.service';
import { OrdersGateway } from './orders.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [OrdersController, OrdersAdminController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersGateway, OrdersService],
})
export class OrdersModule {}
