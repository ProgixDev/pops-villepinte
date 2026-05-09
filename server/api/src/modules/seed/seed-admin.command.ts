import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Command, CommandRunner } from 'nest-commander';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';

@Command({
  name: 'seed:admin',
  description:
    'Provision the super-admin user from SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD',
})
@Injectable()
export class SeedAdminCommand extends CommandRunner {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const email = this.config.get<string>('SUPER_ADMIN_EMAIL');
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD');

    if (!email || !password) {
      console.error(
        '❌ SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env',
      );
      process.exitCode = 1;
      return;
    }

    console.log(`🌱 Provisioning super-admin: ${email}`);

    const existingUser = await this.findUserByEmail(email);
    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      const { error } = await this.supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (error) {
        console.error('❌ updateUserById failed:', error.message);
        process.exitCode = 1;
        return;
      }
      console.log(`✅ Existing auth user updated (${userId})`);
    } else {
      const { data, error } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        console.error('❌ createUser failed:', error?.message);
        process.exitCode = 1;
        return;
      }
      userId = data.user.id;
      console.log(`✅ Auth user created (${userId})`);
    }

    const { error: profileErr } = await this.supabase
      .from('profiles')
      .upsert(
        { id: userId, role: 'admin' },
        { onConflict: 'id' },
      );

    if (profileErr) {
      console.error('❌ profiles upsert failed:', profileErr.message);
      process.exitCode = 1;
      return;
    }

    console.log('🎉 Super-admin ready. Sign in with the email/password above.');
  }

  private async findUserByEmail(email: string) {
    const target = email.toLowerCase();
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await this.supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw new Error(`listUsers failed: ${error.message}`);
      const match = data.users.find(
        (u) => u.email && u.email.toLowerCase() === target,
      );
      if (match) return match;
      if (data.users.length < perPage) return null;
      page += 1;
      if (page > 50) return null;
    }
  }
}
