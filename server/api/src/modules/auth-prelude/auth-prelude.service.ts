import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
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
export class AuthPreludeService implements OnModuleInit {
  private readonly logger = new Logger(AuthPreludeService.name);

  constructor(
    private readonly cfg: ConfigService<Env, true>,
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
    @Inject(SUPABASE_ANON) private readonly anon: SupabaseClient,
  ) {}

  onModuleInit(): void {
    // Log the token prefix at boot so it's obvious *which* token the running
    // process actually has — distinguishes "wrong token" from "Prelude is
    // down" when diagnosing 401s.
    const raw = this.cfg.get('PRELUDE_API_TOKEN', { infer: true });
    const token = raw?.trim() ?? '';
    const base = this.cfg.get('PRELUDE_API_BASE', { infer: true });
    const preview = token
      ? `${token.slice(0, 8)}…${token.slice(-4)} (len ${token.length})`
      : '<missing>';
    this.logger.log(`Prelude base=${base} token=${preview}`);
  }

  async sendCode(rawPhone: string) {
    const phone = this.requireMobile(rawPhone);
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
    const phone = this.requireMobile(rawPhone);
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

  private requireMobile(rawPhone: string): string {
    const phone = normalizeFrenchMobile(rawPhone);
    if (!phone) throw new BadRequestException('Invalid phone format');
    return phone;
  }

  private async callPrelude<T>(path: string, body: unknown): Promise<T> {
    // Trim defensively: a trailing space / CRLF in .env would silently break
    // Bearer auth with a confusing 401.
    const token = this.cfg.get('PRELUDE_API_TOKEN', { infer: true })?.trim();
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
        `Prelude ${path} failed: ${res.status} code=${json.code ?? ''} type=${json.type ?? ''} msg=${json.message ?? ''} req=${json.request_id ?? ''}`,
      );
      if (res.status === 401 || res.status === 403) {
        // 401/403 means our token is wrong, not the user's input. Don't
        // bubble Prelude's raw message to the client — it would be unhelpful
        // and could leak detail. Log enough to debug; throw a 500.
        throw new InternalServerErrorException(
          'OTP provider auth failed. Check PRELUDE_API_TOKEN in the server env.',
        );
      }
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
