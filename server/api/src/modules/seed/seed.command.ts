import { Inject, Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const IMAGES_BUCKET = 'product-images';
// repo-root/assets/products from this file: 5 levels up
const IMAGES_DIR = path.resolve(__dirname, '../../../../../assets/products');

// Mirror of mobile mock data (src/data/menu.ts) — kept inline so seed has no
// frontend deps. Ids are stable slugs because schema uses text primary keys.

const CATEGORIES = [
  { id: 'box', name: 'Box', icon: 'package', display_order: 1 },
  { id: 'smash-burgers', name: 'Smash Burgers', icon: 'sandwich', display_order: 2 },
  { id: 'bucket', name: 'Buckets', icon: 'drumstick', display_order: 3 },
  { id: 'bowls', name: 'Bowls', icon: 'soup', display_order: 4 },
  { id: 'wraps', name: 'Wraps', icon: 'wheat', display_order: 5 },
  { id: 'frites', name: 'Frites', icon: 'cookie', display_order: 6 },
];

const SUPPLEMENTS = [
  { id: 'oignons-caramelises', name: 'Oignon caramélisée', price_eur: 1 },
  { id: 'oignons-frits', name: 'Oignon frits', price_eur: 1 },
  { id: 'jalapenos', name: 'Jalapeños', price_eur: 1 },
  { id: 'galette-pomme-terre', name: 'Galette de pomme de terre', price_eur: 1.5 },
  { id: 'cheddar', name: 'Chedar', price_eur: 1 },
  { id: 'fromage-chevre', name: 'Fromage de chèvre', price_eur: 1 },
  { id: 'raclette', name: 'Raclette', price_eur: 1 },
  { id: 'viande-hachee', name: 'Viande hachée', price_eur: 2 },
  { id: 'tenders-supp', name: 'Tenders', price_eur: 2 },
  { id: 'cordon-bleu', name: 'Cordon bleu', price_eur: 2 },
  { id: 'pastrami', name: 'Pastrami', price_eur: 2 },
  { id: 'bacon', name: 'Bacon', price_eur: 1 },
  { id: 'sauce-blanche', name: 'Sauce blanche maison', price_eur: 0 },
  { id: 'sauce-biggi', name: 'Sauce Biggi', price_eur: 0 },
  { id: 'sauce-poivre', name: 'Sauce poivrée', price_eur: 0 },
];

type ProductSeed = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price_eur: number;
  tags: string[];
  prep_time_minutes: number;
  image_file: string;
};

const PRODUCTS: ProductSeed[] = [
  {
    id: 'box-familiale',
    category_id: 'box',
    name: 'BOX FAMILLIALE',
    description:
      '4 smash burger, 5 wings, 5 tenders, Frite XXL, 4 boisson aux choix, Sauce blanche maison.',
    price_eur: 29,
    tags: ['TOP'],
    prep_time_minutes: 20,
    image_file: 'box_familiale.png',
  },
  {
    id: 'box-nashville',
    category_id: 'box',
    name: 'Box nashville',
    description: '2 tenders nashville, frite, burger aux choix et une boisson.',
    price_eur: 15,
    tags: ['SPICY', 'NOUVEAU'],
    prep_time_minutes: 15,
    image_file: 'box_nashville.png',
  },
  {
    id: 'smash-baleze',
    category_id: 'smash-burgers',
    name: 'Le baleze',
    description:
      '3 steak XL, SAUCE BIGGI, GALTT DE POMME DE TERRE, 2 tenders, Salade, Chedar.',
    price_eur: 12,
    tags: ['NOUVEAU'],
    prep_time_minutes: 15,
    image_file: 'burger_le_baleze.png',
  },
  {
    id: 'smash-smoky',
    category_id: 'smash-burgers',
    name: 'Smoky',
    description:
      '2steak Viande hachée, Pastrami, Sauce poivré, Oignon caramélisé, Chedar.',
    price_eur: 10,
    tags: ['NOUVEAU'],
    prep_time_minutes: 15,
    image_file: 'burger_smoky.png',
  },
  {
    id: 'smash-gourmet',
    category_id: 'smash-burgers',
    name: 'Le gourmet',
    description: '2 steak XL, Jalapenos, pastrami, Oignon caramélisé, Chedar.',
    price_eur: 10,
    tags: ['NOUVEAU', 'TOP'],
    prep_time_minutes: 15,
    image_file: 'burger_gourmet.png',
  },
  {
    id: 'burger-chicken-nashville',
    category_id: 'smash-burgers',
    name: 'Burger chicken nashville',
    description: 'Burger au poulet mariné façon Nashville, bien piquant.',
    price_eur: 9,
    tags: ['SPICY', 'NOUVEAU'],
    prep_time_minutes: 15,
    image_file: 'burger_nashville.png',
  },
  {
    id: 'frite-cheddar',
    category_id: 'frites',
    name: 'Frite chedar',
    description: 'Frites dorées nappées de cheddar fondant.',
    price_eur: 4,
    tags: [],
    prep_time_minutes: 10,
    image_file: 'frite_cheddar.png',
  },
  {
    id: 'frite-cheddar-bacon',
    category_id: 'frites',
    name: 'Frite chedar bacon oignon frits',
    description: 'Frites, cheddar, bacon croustillant, oignons frits.',
    price_eur: 5,
    tags: ['TOP'],
    prep_time_minutes: 10,
    image_file: 'frite_bacon.png',
  },
  {
    id: 'bucket-wings',
    category_id: 'bucket',
    name: 'Buckets wings',
    description: '5 wings, frite, boisson.',
    price_eur: 8,
    tags: [],
    prep_time_minutes: 15,
    image_file: 'bucket_wings.png',
  },
  {
    id: 'bucket-tenders',
    category_id: 'bucket',
    name: 'Buckets tenders',
    description: '5 tenders, frite, boisson.',
    price_eur: 8,
    tags: [],
    prep_time_minutes: 15,
    image_file: 'bucket_tenders.png',
  },
  {
    id: 'bucket-mix',
    category_id: 'bucket',
    name: 'Buckets mix',
    description: '6 wings, 6 tenders, 2 boisson, 2 frite.',
    price_eur: 16,
    tags: ['TOP'],
    prep_time_minutes: 15,
    image_file: 'bucket_mix.png',
  },
  {
    id: 'bucket-family',
    category_id: 'bucket',
    name: 'Buckets family',
    description: '10 tenders, 10 wings, 3 frite, 3 boisson.',
    price_eur: 26,
    tags: ['TOP'],
    prep_time_minutes: 20,
    image_file: 'bucket_family.png',
  },
  {
    id: 'bowl-tenders',
    category_id: 'bowls',
    name: 'Bolws tenders',
    description: 'Frite, bacon, sauce chedar, oignon frits.',
    price_eur: 10,
    tags: [],
    prep_time_minutes: 12,
    image_file: 'bowl_tenders.png',
  },
  {
    id: 'bowl-nashville',
    category_id: 'bowls',
    name: 'Bolws nashville',
    description: 'Frite, tenders nashville, bacon, sauce chedar, oignon frits.',
    price_eur: 10,
    tags: ['SPICY'],
    prep_time_minutes: 12,
    image_file: 'bowl_nashville.png',
  },
  {
    id: 'bowl-gratine',
    category_id: 'bowls',
    name: 'Bolws gratiné',
    description:
      'Frite, tenders, bacon, sauce chedar, oignon frits et mozarella.',
    price_eur: 11,
    tags: ['TOP', 'NOUVEAU'],
    prep_time_minutes: 12,
    image_file: 'bowl_gratine.png',
  },
  {
    id: 'wrap-nashville',
    category_id: 'wraps',
    name: 'Wrap nashville',
    description: 'Tenders nashville, salade, chedar, sauce aux choix.',
    price_eur: 8,
    tags: ['SPICY', 'NOUVEAU'],
    prep_time_minutes: 10,
    image_file: 'wrap_nashville.png',
  },
];

@Command({ name: 'seed:menu', description: 'Seed menu data into Supabase' })
@Injectable()
export class SeedCommand extends CommandRunner {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {
    super();
  }

  private async ensureBucket(): Promise<void> {
    const { data: existing } = await this.supabase.storage.getBucket(IMAGES_BUCKET);
    if (existing) return;
    const { error } = await this.supabase.storage.createBucket(IMAGES_BUCKET, {
      public: true,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Bucket create failed: ${error.message}`);
    }
  }

  private async uploadImages(): Promise<Map<string, string>> {
    await this.ensureBucket();
    const urls = new Map<string, string>();
    const files = Array.from(new Set(PRODUCTS.map((p) => p.image_file)));
    for (const file of files) {
      const full = path.join(IMAGES_DIR, file);
      const buf = await fs.readFile(full);
      const { error: upErr } = await this.supabase.storage
        .from(IMAGES_BUCKET)
        .upload(file, buf, { upsert: true, contentType: 'image/png' });
      if (upErr) {
        throw new Error(`Upload ${file} failed: ${upErr.message}`);
      }
      const { data } = this.supabase.storage
        .from(IMAGES_BUCKET)
        .getPublicUrl(file);
      urls.set(file, data.publicUrl);
    }
    console.log(`✅ ${urls.size} product images uploaded to "${IMAGES_BUCKET}"`);
    return urls;
  }

  async run(): Promise<void> {
    console.log('🌱 Seeding menu data...');

    const imageUrls = await this.uploadImages();

    const { data: categories, error: catError } = await this.supabase
      .from('categories')
      .upsert(
        CATEGORIES.map((c) => ({ ...c, is_active: true })),
        { onConflict: 'id' },
      )
      .select();

    if (catError) {
      console.error('❌ Categories error:', catError.message);
      return;
    }
    console.log(`✅ ${categories.length} categories upserted`);

    const { data: supplements, error: supError } = await this.supabase
      .from('supplements')
      .upsert(
        SUPPLEMENTS.map((s) => ({ ...s, is_active: true })),
        { onConflict: 'id' },
      )
      .select();

    if (supError) {
      console.error('❌ Supplements error:', supError.message);
      return;
    }
    console.log(`✅ ${supplements.length} supplements upserted`);

    const productRows = PRODUCTS.map(({ image_file, ...rest }) => ({
      ...rest,
      image_path: imageUrls.get(image_file) ?? null,
      is_available: true,
    }));

    const { data: products, error: prodError } = await this.supabase
      .from('products')
      .upsert(productRows, { onConflict: 'id' })
      .select();

    if (prodError) {
      console.error('❌ Products error:', prodError.message);
      return;
    }
    console.log(`✅ ${products.length} products upserted`);

    // All products allow all supplements (matches mock ALL_SUPPLEMENTS)
    const junctionRows = PRODUCTS.flatMap((p) =>
      SUPPLEMENTS.map((s) => ({ product_id: p.id, supplement_id: s.id })),
    );

    const productIds = PRODUCTS.map((p) => p.id);
    await this.supabase
      .from('product_supplements')
      .delete()
      .in('product_id', productIds);

    const { error: juncError } = await this.supabase
      .from('product_supplements')
      .insert(junctionRows);

    if (juncError) {
      console.error('❌ Product supplements error:', juncError.message);
      return;
    }
    console.log(`✅ ${junctionRows.length} product-supplement links created`);

    console.log('🎉 Seed complete!');
  }
}
