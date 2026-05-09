import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  productId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  variantId?: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(15)
  supplements?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
