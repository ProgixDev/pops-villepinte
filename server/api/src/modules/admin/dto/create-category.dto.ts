import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
