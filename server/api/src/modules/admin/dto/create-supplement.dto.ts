import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSupplementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsNumber()
  @Min(0)
  price_eur: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
