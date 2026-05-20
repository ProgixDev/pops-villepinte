import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import { loyaltyTier } from '../../common/utils/loyalty';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {}

  async getProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) throw new NotFoundException('Profile not found');

    return {
      ...data,
      loyalty_tier: loyaltyTier(data.order_count),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ name: dto.name, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Mirror to auth.users.user_metadata.name so the JWT/session carries it.
    // Clients reading session.user.user_metadata.name (e.g. mobile restoreSession)
    // stay in sync without an extra API roundtrip.
    if (dto.name) {
      await this.supabase.auth.admin.updateUserById(userId, {
        user_metadata: { name: dto.name },
      });
    }

    return {
      ...data,
      loyalty_tier: loyaltyTier(data.order_count),
    };
  }
}
