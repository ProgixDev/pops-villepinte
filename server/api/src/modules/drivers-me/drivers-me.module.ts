import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { DriversMeController } from './drivers-me.controller';
import { DriversMeService } from './drivers-me.service';

@Module({
  imports: [OrdersModule],
  controllers: [DriversMeController],
  providers: [DriversMeService],
})
export class DriversMeModule {}
