import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ProductVariantInput {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  @IsNumber()
  @Min(0)
  price_eur: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;
}

export class ManageProductVariantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInput)
  variants: ProductVariantInput[];
}
