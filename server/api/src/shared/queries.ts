/**
 * Supabase select fragments shared across services so that adding/removing a
 * column on `products` is a single-edit change.
 */

/**
 * Full product row + nested variants + supplements (via the junction table).
 * Use with `.select(PRODUCT_SELECT_WITH_RELATIONS)` or embed inside a parent
 * relation, e.g. `.select(`position, products(${PRODUCT_SELECT_WITH_RELATIONS})`)`.
 */
export const PRODUCT_SELECT_WITH_RELATIONS =
  '*, image_url:image_path, product_variants(*), product_supplements(supplement_id, supplements(*))';
