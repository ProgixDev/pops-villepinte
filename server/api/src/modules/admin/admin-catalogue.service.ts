import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import { PRODUCT_SELECT_WITH_RELATIONS } from '../../shared/queries';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, ToggleAvailabilityDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { UpdateSupplementDto } from './dto/update-supplement.dto';
import { ManageProductSupplementsDto } from './dto/manage-product-supplements.dto';
import { ManageProductVariantsDto } from './dto/manage-product-variants.dto';
import { SetHomeSignaturesDto } from './dto/set-home-signatures.dto';
import { SetHomeAdviceDto } from './dto/set-home-advice.dto';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
import { CreateAccompagnementDto } from './dto/create-accompagnement.dto';
import { UpdateAccompagnementDto } from './dto/update-accompagnement.dto';
import { ACCOMPAGNEMENT_SELECT } from '../accompagnements/accompagnements.service';

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
      .select(PRODUCT_SELECT_WITH_RELATIONS)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getProduct(id: string) {
    const { data, error } = await this.supabase
      .from('products')
      .select(PRODUCT_SELECT_WITH_RELATIONS)
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
    const row = this.normalizeProductPayload(dto);
    const { data, error } = await this.supabase
      .from('products')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const row = this.normalizeProductPayload(dto);
    const { data, error } = await this.supabase
      .from('products')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundException('Product not found');
    return data;
  }

  // The schema column is `image_path` but the API surface uses `image_url`
  // (aliased on read) — accept either on write and translate to the column.
  private normalizeProductPayload<T extends { image_url?: string }>(
    dto: T,
  ): Omit<T, 'image_url'> & { image_path?: string | null } {
    const { image_url, ...rest } = dto;
    if (image_url === undefined) return rest as never;
    return { ...rest, image_path: image_url || null } as never;
  }

  async deleteProduct(id: string) {
    // Check if product has orders
    const { count } = await this.supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id);

    if (count && count > 0) {
      // Soft delete via availability flag — the products table tracks
      // visibility on is_available; there is no is_active column.
      const { data, error } = await this.supabase
        .from('products')
        .update({ is_available: false, updated_at: new Date().toISOString() })
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

  async setProductVariants(id: string, dto: ManageProductVariantsDto) {
    // Verify product exists so we surface a 404 rather than an opaque error.
    const { data: product, error: productError } = await this.supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) throw new NotFoundException('Product not found');

    await this.supabase
      .from('product_variants')
      .delete()
      .eq('product_id', id);

    if (dto.variants.length === 0) {
      return { product_id: id, variants: [] };
    }

    const rows = dto.variants.map((v, idx) => ({
      id: v.id && v.id.length > 0 ? v.id : `${id}-v${idx + 1}`,
      product_id: id,
      label: v.label,
      price_eur: v.price_eur,
      sort: v.sort ?? idx,
    }));

    const { data, error } = await this.supabase
      .from('product_variants')
      .insert(rows)
      .select();

    if (error) throw error;
    return { product_id: id, variants: data ?? [] };
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
    // categories has no updated_at column — pass dto through unchanged.
    const { data, error } = await this.supabase
      .from('categories')
      .update(dto)
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
    // supplements has no updated_at column — pass dto through unchanged.
    const { data, error } = await this.supabase
      .from('supplements')
      .update(dto)
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
        `position, products(${PRODUCT_SELECT_WITH_RELATIONS})`,
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
        `position, products(${PRODUCT_SELECT_WITH_RELATIONS})`,
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
  private static readonly SHOP_SELECT =
    'open_days, open_hours, hours_by_day, delivery_base_fee_eur, delivery_per_km_eur, support_phone, updated_at';

  async getShopSettings() {
    const { data, error } = await this.supabase
      .from('shop_settings')
      .select(AdminCatalogueService.SHOP_SELECT)
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
    if (dto.hours_by_day !== undefined) patch.hours_by_day = dto.hours_by_day;
    if (dto.delivery_base_fee_eur !== undefined) {
      patch.delivery_base_fee_eur = dto.delivery_base_fee_eur;
    }
    if (dto.delivery_per_km_eur !== undefined) {
      patch.delivery_per_km_eur = dto.delivery_per_km_eur;
    }
    if (dto.support_phone !== undefined) {
      // Empty string clears it back to null so the driver app hides the button.
      patch.support_phone = dto.support_phone.trim() || null;
    }

    const { data, error } = await this.supabase
      .from('shop_settings')
      .update(patch)
      .eq('id', 1)
      .select(AdminCatalogueService.SHOP_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  // Accompagnements (drinks / simple sides — shown in mobile cart "Notre conseil")
  async listAccompagnements() {
    const { data, error } = await this.supabase
      .from('accompagnements')
      .select(ACCOMPAGNEMENT_SELECT)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getAccompagnement(id: string) {
    const { data, error } = await this.supabase
      .from('accompagnements')
      .select(ACCOMPAGNEMENT_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Accompagnement not found');
    return data;
  }

  async createAccompagnement(dto: CreateAccompagnementDto) {
    const { data, error } = await this.supabase
      .from('accompagnements')
      .insert(dto)
      .select(ACCOMPAGNEMENT_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Un accompagnement avec cet identifiant existe déjà',
        );
      }
      throw error;
    }
    return data;
  }

  async updateAccompagnement(id: string, dto: UpdateAccompagnementDto) {
    const { data, error } = await this.supabase
      .from('accompagnements')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(ACCOMPAGNEMENT_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Accompagnement not found');
    return data;
  }

  async deleteAccompagnement(id: string) {
    // Best-effort: delete the image from storage too. We ignore the result
    // because the row delete is the authoritative action and a missing object
    // shouldn't block it.
    const { data: existing } = await this.supabase
      .from('accompagnements')
      .select('image_path')
      .eq('id', id)
      .maybeSingle();

    if (existing?.image_path) {
      const key = this.extractStorageKey(existing.image_path, 'accompagnements');
      if (key) {
        await this.supabase.storage.from('accompagnements').remove([key]);
      }
    }

    const { error } = await this.supabase
      .from('accompagnements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }

  // Public URL → storage key for the named bucket. Returns null when the URL
  // does not belong to the bucket (e.g. an external image).
  private extractStorageKey(publicUrl: string, bucket: string): string | null {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  }
}
