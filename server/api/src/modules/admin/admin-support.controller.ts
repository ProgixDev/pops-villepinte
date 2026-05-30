import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminSupportService } from './admin-support.service';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminSupportController {
  constructor(private readonly svc: AdminSupportService) {}

  @Get('tickets')
  tickets(@Query('status') status?: 'open' | 'resolved') {
    return this.svc.listTickets(status);
  }

  @Patch('tickets/:id')
  updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.svc.updateTicket(id, dto);
  }

  @Get('driver-ratings')
  driverRatings(@Query('driver_id') driverId?: string) {
    return this.svc.listDriverRatings(driverId);
  }
}
