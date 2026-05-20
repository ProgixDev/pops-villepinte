import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
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

type PreludeError = {
  code?: string;
  message?: string;
  type?: string;
  request_id?: string;
};

type PreludeVerification = {
  id: string;
  status: string;
  request_id?: string;
};

type PreludeCheck = {
  id: string;
  status: 'success' | 'failure' | 'expired_or_not_found';
  request_id?: string;
};

@Injectable()
export class AuthPreludeService {
  private readonly logger = new Logger(AuthPreludeService.name);

  constructor(
    private readonly cfg: ConfigService<Env, true>,
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
    @Inject(SUPABASE_ANON) private readonly anon: SupabaseClient,
  ) {}

  async sendCode(rawPhone: string) {
    const phone = this.requireFrenchMobile(rawPhone);
    const body = { target: { type: 'phone_number', value: phone } };
    const response = await this.callPrelude<PreludeVerification>(
      '/verification',
      body,
    );

    // Prelude returns several non-error statuses (retry, challenged, blocked).
    // We surface them to the client so it can react (e.g. show a CAPTCHA later).
    return { status: response.status, request_id: response.request_id };
  }

  async verifyCode(rawPhone: string, code: string) {
    const phone = this.requireFrenchMobile(rawPhone);
    const body = {
      target: { type: 'phone_number', value: phone },
      code,
    };
    const check = await this.callPrelude<PreludeCheck>(
      '/verification/check',
      body,
    );

    if (check.status !== 'success') {
      throw new UnauthorizedException(
        check.status === 'expired_or_not_found'
          ? 'Code expiré, demande un nouveau code.'
          : 'Code invalide.',
      );
    }

    return provisionAndSignInByPhone(this.admin, this.anon, phone);
  }

  private requireFrenchMobile(rawPhone: string): string {
    const phone = normalizeFrenchMobile(rawPhone);
    if (!phone) throw new BadRequestException('Invalid phone format');
    return phone;
  }

  private async callPrelude<T>(path: string, body: unknown): Promise<T> {
    const token = this.cfg.get('PRELUDE_API_TOKEN', { infer: true });
    if (!token) {
      throw new InternalServerErrorException('PRELUDE_API_TOKEN is not set');
    }
    const base = this.cfg.get('PRELUDE_API_BASE', { infer: true });

    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as T & PreludeError;

    if (!res.ok) {
      this.logger.warn(
        `Prelude ${path} failed: ${res.status} ${json.code ?? ''} ${json.message ?? ''}`,
      );
      if (res.status === 400) {
        throw new BadRequestException(json.message ?? 'Invalid request');
      }
      throw new InternalServerErrorException(
        json.message ?? `Prelude error (${res.status})`,
      );
    }

    return json;
  }
}
