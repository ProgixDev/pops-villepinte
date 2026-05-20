import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON } from '../../common/supabase/supabase.module';
import { PRODUCT_SELECT_WITH_RELATIONS } from '../../shared/queries';
import { MenuProductsQueryDto } from './dto/menu-query.dto';

@Injectable()
export class MenuService {
  constructor(
    @Inject(SUPABASE_ANON) private readonly supabase: SupabaseClient,
  ) {}

  async getCategories() {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getProducts(query: MenuProductsQueryDto) {
    let qb = this.supabase
      .from('products')
      .select(PRODUCT_SELECT_WITH_RELATIONS)
      .eq('is_available', true);

    if (query.category_id) {
      qb = qb.eq('category_id', query.category_id);
    }

    if (query.search) {
      qb = qb.ilike('name', `%${query.search}%`);
    }

    qb = qb.order('name', { ascending: true });

    const { data, error } = await qb;
    if (error) throw error;
    return data;
  }

  async getProductById(id: string) {
    const { data, error } = await this.supabase
      .from('products')
      .select(PRODUCT_SELECT_WITH_RELATIONS)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getSupplements() {
    const { data, error } = await this.supabase
      .from('supplements')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getSignatures() {
    return this.getCuratedProducts('home_signatures');
  }

  async getAdvice() {
    return this.getCuratedProducts('home_advice');
  }

  async getShopSettings() {
    const { data, error } = await this.supabase
      .from('shop_settings')
      .select('open_days, open_hours, updated_at')
      .eq('id', 1)
      .single();

    if (error) throw error;
    return data;
  }

  private async getCuratedProducts(table: 'home_signatures' | 'home_advice') {
    const { data: rows, error: rowsError } = await this.supabase
      .from(table)
      .select('product_id, position')
      .order('position', { ascending: true });

    if (rowsError) throw rowsError;
    if (!rows || rows.length === 0) return [];

    const ids = rows.map((r) => r.product_id);
    const { data: products, error: productsError } = await this.supabase
      .from('products')
      .select(PRODUCT_SELECT_WITH_RELATIONS)
      .in('id', ids)
      .eq('is_available', true);

    if (productsError) throw productsError;

    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
    return rows
      .map((r) => byId.get(r.product_id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }
}
