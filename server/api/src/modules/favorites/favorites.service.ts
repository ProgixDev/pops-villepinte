import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {}

  async list(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => row.product_id as string);
  }

  async add(userId: string, productId: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .from('favorites')
      .upsert(
        { user_id: userId, product_id: productId },
        { onConflict: 'user_id,product_id', ignoreDuplicates: true },
      );
    if (error) throw error;
    return { ok: true };
  }

  async remove(userId: string, productId: string): Promise<{ ok: true }> {
    const { error } = await this.supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    if (error) throw error;
    return { ok: true };
  }
}
