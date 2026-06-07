import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const POPUP_TIERS = ['BIENVENUE', 'HABITUE', 'VIP', 'LEGENDE'] as const;

export class CreatePopupDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  // Public URL of the uploaded poster (Supabase `popups` bucket).
  @IsString()
  image_url!: string;

  // Empty = shown to everyone. Otherwise restricted to these loyalty tiers.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(POPUP_TIERS as unknown as string[], { each: true })
  target_tiers?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
