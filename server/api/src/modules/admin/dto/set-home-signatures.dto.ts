import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class SetHomeSignaturesDto {
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  product_ids: string[];
}
