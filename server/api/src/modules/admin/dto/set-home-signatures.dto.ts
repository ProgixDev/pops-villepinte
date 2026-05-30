import { IsArray, IsString } from 'class-validator';

export class SetHomeSignaturesDto {
  // No max — admin can feature any number of signature products.
  @IsArray()
  @IsString({ each: true })
  product_ids: string[];
}
