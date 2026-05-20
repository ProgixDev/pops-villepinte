import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { SupabaseModule } from './common/supabase/supabase.module';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HealthModule } from './modules/health/health.module';
import { MenuModule } from './modules/menu/menu.module';
import { ProfileModule } from './modules/profile/profile.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SeedModule } from './modules/seed/seed.module';
import { AuthDevModule } from './modules/auth-dev/auth-dev.module';
import { AuthPreludeModule } from './modules/auth-prelude/auth-prelude.module';
import { AccompagnementsModule } from './modules/accompagnements/accompagnements.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    JwtModule.register({ global: true }),
    SupabaseModule,
    HealthModule,
    MenuModule,
    ProfileModule,
    OrdersModule,
    AdminModule,
    AnalyticsModule,
    SeedModule,
    AuthDevModule,
    AuthPreludeModule,
    AccompagnementsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
