import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON } from '../../common/supabase/supabase.module';

export const ACCOMPAGNEMENT_SELECT =
  'id, name, price_eur, sort_order, is_active, image_url:image_path, created_at, updated_at';

@Injectable()
export class AccompagnementsService {
  constructor(
    @Inject(SUPABASE_ANON) private readonly supabase: SupabaseClient,
  ) {}

  async list() {
    const { data, error } = await this.supabase
      .from('accompagnements')
      .select(ACCOMPAGNEMENT_SELECT)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
