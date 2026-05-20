import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { provisionAndSignInByPhone } from '../../common/supabase/auth-helpers';
import {
  SUPABASE_ADMIN,
  SUPABASE_ANON,
} from '../../common/supabase/supabase.module';
import { normalizeFrenchMobile } from '../../common/utils/phone';
import type { Env } from '../../config/env.validation';

const DEV_OTP_CODE = '000000';

@Injectable()
export class AuthDevService {
  constructor(
    private readonly cfg: ConfigService<Env, true>,
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
    @Inject(SUPABASE_ANON) private readonly anon: SupabaseClient,
  ) {}

  async signIn(rawPhone: string, code: string) {
    if (!this.cfg.get('DEV_AUTH_ENABLED', { infer: true })) {
      throw new NotFoundException();
    }
    if (code !== DEV_OTP_CODE) {
      throw new UnauthorizedException('Invalid dev OTP');
    }

    const phone = normalizeFrenchMobile(rawPhone);
    if (!phone) throw new BadRequestException('Invalid phone format');

    return provisionAndSignInByPhone(this.admin, this.anon, phone);
  }
}
