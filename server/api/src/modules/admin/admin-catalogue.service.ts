import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, ToggleAvailabilityDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { UpdateSupplementDto } from './dto/update-supplement.dto';
import { ManageProductSupplementsDto } from './dto/manage-product-supplements.dto';
import { SetHomeSignaturesDto } from './dto/set-home-signatures.dto';
import { SetHomeAdviceDto } from './dto/set-home-advice.dto';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';

@Injectable()
export class AdminCatalogueService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {}

  // Read endpoints (admin sees everything, including unavailable / inactive)
  async listCategories() {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async listProducts() {
    const { data, error } = await this.supabase
      .from('products')
      .select(
        '*, image_url:image_path, product_variants(*), product_supplements(supplement_id, supplements(*))',
      )
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getProduct(id: string) {
    const { data, error } = await this.supabase
      .from('products')
      .select(
        '*, image_url:image_path, product_variants(*), product_supplements(supplement_id, supplements(*))',
      )
      .eq('id', id)
      .single();
    if (error) throw new NotFoundException('Product not found');
    return data;
  }

  async listSupplements() {
    const { data, error } = await this.supabase
      .from('supplements')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  // Products
  async createProduct(dto: CreateProductDto) {
    const { data, error } = await this.supabase
      .from('products')
      .insert(dto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const { data, error } = await this.supabase
      .from('products')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Product not found');
    return data;
  }

  async deleteProduct(id: string) {
    // Check if product has orders
    const { count } = await this.supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id);

    if (count && count > 0) {
      // Soft delete
      const { data, error } = await this.supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { deleted: false, deactivated: true, product: data };
    }

    const { error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true, deactivated: false };
  }

  async toggleAvailability(id: string, dto: ToggleAvailabilityDto) {
    const { data, error } = await this.supabase
      .from('products')
      .update({
        is_available: dto.is_available,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Product not found');
    return data;
  }

  async setProductSupplements(id: string, dto: ManageProductSupplementsDto) {
    // Delete existing
    await this.supabase
      .from('product_supplements')
      .delete()
      .eq('product_id', id);

    if (dto.supplement_ids.length === 0) return { product_id: id, supplements: [] };

    // Insert new
    const { data, error } = await this.supabase
      .from('product_supplements')
      .insert(
        dto.supplement_ids.map((sid) => ({
          product_id: id,
          supplement_id: sid,
        })),
      )
      .select('supplement_id, supplements(*)');

    if (error) throw error;
    return { product_id: id, supplements: data };
  }

  // Categories
  async createCategory(dto: CreateCategoryDto) {
    const { data, error } = await this.supabase
      .from('categories')
      .insert(dto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const { data, error } = await this.supabase
      .from('categories')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Category not found');
    return data;
  }

  async deleteCategory(id: string) {
    // Check if category has products
    const { count } = await this.supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id);

    if (count && count > 0) {
      throw new ConflictException(
        'Cannot delete category with existing products',
      );
    }

    const { error } = await this.supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }

  async reorderCategories(dto: ReorderCategoriesDto) {
    const updates = dto.categories.map((cat) =>
      this.supabase
        .from('categories')
        .update({ display_order: cat.display_order })
        .eq('id', cat.id),
    );

    await Promise.all(updates);
    return { reordered: true };
  }

  // Supplements
  async createSupplement(dto: CreateSupplementDto) {
    const { data, error } = await this.supabase
      .from('supplements')
      .insert(dto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSupplement(id: string, dto: UpdateSupplementDto) {
    const { data, error } = await this.supabase
      .from('supplements')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Supplement not found');
    return data;
  }

  async deleteSupplement(id: string) {
    // Remove from junction table first
    await this.supabase
      .from('product_supplements')
      .delete()
      .eq('supplement_id', id);

    const { error } = await this.supabase
      .from('supplements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }

  // Home signatures (hero carousel — up to 3 products)
  async getHomeSignatures() {
    const { data, error } = await this.supabase
      .from('home_signatures')
      .select(
        'position, products(*, image_url:image_path, product_variants(*), product_supplements(supplement_id, supplements(*)))',
      )
      .order('position', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async setHomeSignatures(dto: SetHomeSignaturesDto) {
    if (dto.product_ids.length > 3) {
      throw new BadRequestException('Maximum 3 signature products allowed');
    }

    if (dto.product_ids.length > 0) {
      const { data: existing, error: lookupError } = await this.supabase
        .from('products')
        .select('id')
        .in('id', dto.product_ids);

      if (lookupError) throw lookupError;
      const found = new Set((existing ?? []).map((p) => p.id));
      const missing = dto.product_ids.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new NotFoundException(
          `Product(s) not found: ${missing.join(', ')}`,
        );
      }
    }

    const { error: deleteError } = await this.supabase
      .from('home_signatures')
      .delete()
      .gte('position', 0);
    if (deleteError) throw deleteError;

    if (dto.product_ids.length === 0) return { signatures: [] };

    const rows = dto.product_ids.map((product_id, position) => ({
      product_id,
      position,
    }));

    const { data, error } = await this.supabase
      .from('home_signatures')
      .insert(rows)
      .select('product_id, position');

    if (error) throw error;
    return { signatures: data };
  }

  // Home advice ("Notre conseil" cart suggestions — up to 6 products)
  async getHomeAdvice() {
    const { data, error } = await this.supabase
      .from('home_advice')
      .select(
        'position, products(*, image_url:image_path, product_variants(*), product_supplements(supplement_id, supplements(*)))',
      )
      .order('position', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async setHomeAdvice(dto: SetHomeAdviceDto) {
    if (dto.product_ids.length > 6) {
      throw new BadRequestException('Maximum 6 advice products allowed');
    }

    if (dto.product_ids.length > 0) {
      const { data: existing, error: lookupError } = await this.supabase
        .from('products')
        .select('id')
        .in('id', dto.product_ids);

      if (lookupError) throw lookupError;
      const found = new Set((existing ?? []).map((p) => p.id));
      const missing = dto.product_ids.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new NotFoundException(
          `Product(s) not found: ${missing.join(', ')}`,
        );
      }
    }

    const { error: deleteError } = await this.supabase
      .from('home_advice')
      .delete()
      .gte('position', 0);
    if (deleteError) throw deleteError;

    if (dto.product_ids.length === 0) return { advice: [] };

    const rows = dto.product_ids.map((product_id, position) => ({
      product_id,
      position,
    }));

    const { data, error } = await this.supabase
      .from('home_advice')
      .insert(rows)
      .select('product_id, position');

    if (error) throw error;
    return { advice: data };
  }

  // Shop settings (single-row table, id=1)
  async getShopSettings() {
    const { data, error } = await this.supabase
      .from('shop_settings')
      .select('open_days, open_hours, updated_at')
      .eq('id', 1)
      .single();

    if (error) throw error;
    return data;
  }

  async updateShopSettings(dto: UpdateShopSettingsDto) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.open_days !== undefined) patch.open_days = dto.open_days;
    if (dto.open_hours !== undefined) patch.open_hours = dto.open_hours;

    const { data, error } = await this.supabase
      .from('shop_settings')
      .update(patch)
      .eq('id', 1)
      .select('open_days, open_hours, updated_at')
      .single();

    if (error) throw error;
    return data;
  }
}
