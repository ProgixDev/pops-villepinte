import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { AdminGuard } from '../../common/guards/admin.guard';
import { OrdersService } from './orders.service';
import { OrdersGateway, OrderEvent } from './orders.gateway';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminOrdersQueryDto } from './dto/orders-query.dto';

@Controller('admin/orders')
@UseGuards(AdminGuard)
export class OrdersAdminController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly gateway: OrdersGateway,
  ) {}

  @Get()
  getOrders(@Query() query: AdminOrdersQueryDto) {
    return this.ordersService.getAdminOrders(query);
  }

  @Sse('live')
  live(): Observable<MessageEvent> {
    return this.gateway.events$.pipe(
      map(
        (event: OrderEvent) =>
          ({
            data: JSON.stringify(event),
          }) as MessageEvent,
      ),
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.advanceOrderStatus(id, dto.status);
  }

  @Patch(':id/cancel')
  cancelOrder(@Param('id') id: string) {
    return this.ordersService.adminCancelOrder(id);
  }

  @Delete(':id')
  deleteOrder(@Param('id') id: string) {
    return this.ordersService.deleteOrder(id);
  }
}
