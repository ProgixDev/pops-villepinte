import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class SetHomeAdviceDto {
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  product_ids: string[];
}
