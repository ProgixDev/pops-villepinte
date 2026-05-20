import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Public } from '../../common/decorators/public.decorator';
import { AdminCustomersService } from './admin-customers.service';
import { CustomersQueryDto } from './dto/customers-query.dto';
import { UpdateLoyaltySettingsDto } from './dto/update-loyalty-settings.dto';

@Controller('admin/customers')
@UseGuards(AdminGuard)
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get()
  getCustomers(@Query() query: CustomersQueryDto) {
    return this.customersService.getCustomers(query);
  }

  @Get(':id')
  getCustomer(@Param('id') id: string) {
    return this.customersService.getCustomerDetail(id);
  }

  @Patch(':id/block')
  blockCustomer(@Param('id') id: string) {
    return this.customersService.blockCustomer(id);
  }

  @Patch(':id/unblock')
  unblockCustomer(@Param('id') id: string) {
    return this.customersService.unblockCustomer(id);
  }
}

@Controller('admin/loyalty')
@UseGuards(AdminGuard)
export class AdminLoyaltyController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get()
  getLoyalty() {
    return this.customersService.getLoyaltyConfig();
  }

  @Put()
  updateLoyalty(@Body() dto: UpdateLoyaltySettingsDto) {
    return this.customersService.updateLoyaltyConfig(dto);
  }
}

// Public read so the mobile app can render the tier ladder + progress bar
// without exposing the admin write endpoint.
@Controller('loyalty')
@Public()
export class PublicLoyaltyController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get()
  async getLoyaltyPublic() {
    const cfg = await this.customersService.getLoyaltyConfig();
    return {
      habitue_min: cfg.habitue_min,
      vip_min: cfg.vip_min,
      legende_min: cfg.legende_min,
    };
  }
}
