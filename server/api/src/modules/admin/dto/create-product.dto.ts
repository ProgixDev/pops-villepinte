import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0)
  price_eur: number;

  @IsString()
  @MinLength(1)
  category_id: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  id?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  prep_time_minutes?: number;

  @IsOptional()
  @IsBoolean()
  is_available?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
