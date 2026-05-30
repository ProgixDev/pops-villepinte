import { Module } from '@nestjs/common';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { AdminCatalogueService } from './admin-catalogue.service';
import {
  AdminCustomersController,
  AdminLoyaltyController,
  PublicLoyaltyController,
} from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';

@Module({
  controllers: [
    AdminCatalogueController,
    AdminCustomersController,
    AdminLoyaltyController,
    PublicLoyaltyController,
    AdminSupportController,
  ],
  providers: [AdminCatalogueService, AdminCustomersService, AdminSupportService],
  exports: [AdminCustomersService],
})
export class AdminModule {}
