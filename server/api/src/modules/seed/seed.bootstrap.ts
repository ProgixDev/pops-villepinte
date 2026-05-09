import { CommandFactory } from 'nest-commander';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '../../config/configuration';
import { validateEnv } from '../../config/env.validation';
import { SupabaseModule } from '../../common/supabase/supabase.module';
import { SeedCommand } from './seed.command';
import { SeedAdminCommand } from './seed-admin.command';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    SupabaseModule,
  ],
  providers: [SeedCommand, SeedAdminCommand],
})
class SeedAppModule {}

async function bootstrap() {
  await CommandFactory.run(SeedAppModule, {
    logger: ['error', 'warn'],
  });
}

bootstrap();
