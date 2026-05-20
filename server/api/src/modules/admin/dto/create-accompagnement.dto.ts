import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAccompagnementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  price_eur: number;

  @IsOptional()
  @IsString()
  image_path?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
