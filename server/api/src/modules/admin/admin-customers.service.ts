import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import {
  getLoyaltySettings,
  invalidateLoyaltyCache,
  loyaltyTierFor,
  tierRange,
} from '../../common/utils/loyalty';
import { CustomersQueryDto } from './dto/customers-query.dto';
import { UpdateLoyaltySettingsDto } from './dto/update-loyalty-settings.dto';

@Injectable()
export class AdminCustomersService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {}

  async getCustomers(query: CustomersQueryDto) {
    const settings = await getLoyaltySettings(this.supabase);
    let qb = this.supabase.from('profiles').select('*');

    if (query.search) {
      qb = qb.or(
        `name.ilike.%${query.search}%,phone.ilike.%${query.search}%`,
      );
    }

    if (query.tier) {
      const range = tierRange(query.tier, settings);
      qb = qb.gte('order_count', range.min).lte('order_count', range.max);
    }

    qb = qb
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + (query.limit ?? 20) - 1);

    const { data, error } = await qb;
    if (error) throw error;

    return data.map((profile) => ({
      ...profile,
      loyalty_tier: loyaltyTierFor(profile.order_count, settings),
    }));
  }

  async getCustomerDetail(id: string) {
    const settings = await getLoyaltySettings(this.supabase);
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !profile) throw new NotFoundException('Customer not found');

    const { data: orders } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      ...profile,
      loyalty_tier: loyaltyTierFor(profile.order_count, settings),
      recent_orders: orders ?? [],
    };
  }

  async blockCustomer(id: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ is_blocked: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Customer not found');
    return data;
  }

  async unblockCustomer(id: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ is_blocked: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Customer not found');
    return data;
  }

  // Loyalty config — single-row settings + a tier distribution summary
  // computed on the fly so the superadmin loyalty page can preview.
  async getLoyaltyConfig() {
    const settings = await getLoyaltySettings(this.supabase);
    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('order_count');
    const distribution: Record<string, number> = {
      BIENVENUE: 0,
      HABITUE: 0,
      VIP: 0,
      LEGENDE: 0,
    };
    for (const p of profiles ?? []) {
      distribution[loyaltyTierFor(p.order_count, settings)]++;
    }
    return {
      ...settings,
      distribution,
      total_customers: profiles?.length ?? 0,
    };
  }

  async updateLoyaltyConfig(dto: UpdateLoyaltySettingsDto) {
    const current = await getLoyaltySettings(this.supabase);
    const next = {
      habitue_min: dto.habitue_min ?? current.habitue_min,
      vip_min: dto.vip_min ?? current.vip_min,
      legende_min: dto.legende_min ?? current.legende_min,
    };
    if (
      next.habitue_min >= next.vip_min ||
      next.vip_min >= next.legende_min
    ) {
      throw new BadRequestException(
        'Les paliers doivent être strictement croissants : HABITUÉ < VIP < LÉGENDE.',
      );
    }
    const { data, error } = await this.supabase
      .from('loyalty_settings')
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;
    invalidateLoyaltyCache();
    return data;
  }
}
