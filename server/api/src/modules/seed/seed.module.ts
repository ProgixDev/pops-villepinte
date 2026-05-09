import { Module } from '@nestjs/common';
import { SeedCommand } from './seed.command';
import { SeedAdminCommand } from './seed-admin.command';

@Module({
  providers: [SeedCommand, SeedAdminCommand],
})
export class SeedModule {}
