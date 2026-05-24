import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();

    // Verify the token via Supabase itself rather than decoding it locally.
    // Supabase validates the JWT regardless of whether the project signs with
    // the legacy HS256 secret or the newer asymmetric (RS256/ES256) keys, so
    // this avoids a class of production bugs where the deployment's
    // SUPABASE_JWT_SECRET is wrong, empty, or out of sync with a project that
    // has migrated to asymmetric JWT signing keys.
    const { data: userRes, error: authErr } = await this.admin.auth.getUser(
      token,
    );
    if (authErr || !userRes?.user) {
      this.logger.warn(
        `Token rejected by Supabase: ${authErr?.message ?? 'no user'}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
    const authUser = userRes.user;

    const { data, error } = await this.admin
      .from('profiles')
      .select('id, name, phone, order_count, role, is_blocked')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error || !data) {
      this.logger.warn(
        `Profile lookup failed for ${authUser.id}: ${error?.message ?? 'not found'}`,
      );
      throw new UnauthorizedException('Profile not found');
    }

    if (data.is_blocked === true) {
      throw new ForbiddenException('Account suspended');
    }

    req.user = {
      id: authUser.id,
      phone: authUser.phone ?? data.phone ?? null,
      email: authUser.email ?? null,
      role: data.role,
      profile: {
        id: data.id,
        name: data.name,
        phone: data.phone,
        orderCount: data.order_count,
        role: data.role,
      },
    };
    return true;
  }
}
