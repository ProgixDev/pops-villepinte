import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversQueryDto } from './dto/drivers-query.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';

@Controller('admin/drivers')
@UseGuards(AdminGuard)
export class AdminDriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  list(@Query() query: DriversQueryDto) {
    return this.drivers.listDrivers(query);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.drivers.getDriver(id);
  }

  @Post()
  create(@Body() dto: CreateDriverDto) {
    return this.drivers.createDriver(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.drivers.updateDriver(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.drivers.deleteDriver(id);
  }

  // Assignments owned by a specific driver — kitchen / fleet view.
  @Get(':id/orders')
  listAssignments(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.drivers.listAssignmentsForDriver(id);
  }
}

// Assignments owned by an order — order-detail drawer.
@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrderAssignmentsController {
  constructor(private readonly drivers: DriversService) {}

  @Get(':id/assignments')
  listForOrder(@Param('id') orderId: string) {
    return this.drivers.listAssignmentsForOrder(orderId);
  }

  @Post(':id/assign')
  assign(
    @Param('id') orderId: string,
    @Body() dto: AssignDriverDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.drivers.assignOrderToDriver(orderId, dto, user.id);
  }
}
