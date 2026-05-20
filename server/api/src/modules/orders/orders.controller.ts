import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CustomerOrdersQueryDto } from './dto/orders-query.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.id, dto);
  }

  @Get()
  getOrders(
    @CurrentUser() user: { id: string },
    @Query() query: CustomerOrdersQueryDto,
  ) {
    return this.ordersService.getCustomerOrders(user.id, query);
  }

  @Get(':id')
  getOrder(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.ordersService.getCustomerOrderById(user.id, id);
  }

  @Patch(':id/cancel')
  cancelOrder(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.ordersService.cancelCustomerOrder(user.id, id);
  }

  // Customer self-confirms reception. RLS already restricts the row to the
  // caller; the service double-checks the lifecycle (pickup vs delivery).
  @Patch(':id/picked-up')
  confirmPickedUp(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.ordersService.confirmCustomerPickedUp(user.id, id);
  }
}
