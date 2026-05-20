import { Module } from '@nestjs/common';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { AdminCatalogueService } from './admin-catalogue.service';
import {
  AdminCustomersController,
  AdminLoyaltyController,
  PublicLoyaltyController,
} from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';

@Module({
  controllers: [
    AdminCatalogueController,
    AdminCustomersController,
    AdminLoyaltyController,
    PublicLoyaltyController,
  ],
  providers: [AdminCatalogueService, AdminCustomersService],
  exports: [AdminCustomersService],
})
export class AdminModule {}
