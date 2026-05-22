import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWT_SECRET: z.string().min(20),

  CORS_ORIGINS: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  OTP_RATE_PER_HOUR: z.coerce.number().int().positive().default(5),

  PRODUCT_IMAGES_BUCKET: z.string().default('product-images'),

  // Prelude (https://prelude.so) — SMS OTP delivery + verification.
  PRELUDE_API_TOKEN: z.string().min(20),
  PRELUDE_API_BASE: z.string().url().default('https://api.prelude.dev/v2'),

  // Bootstrap-only credentials read by `seed:admin` to provision the super-admin
  // in Supabase Auth. After provisioning, Supabase owns the password.
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
