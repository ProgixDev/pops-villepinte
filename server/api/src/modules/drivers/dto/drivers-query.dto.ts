import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class DriversQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  // Sent as "true" / "false" on the wire — kept loose so we can parse manually
  // and still let `false` filter through (a boolean DTO with implicit
  // conversion would treat the empty case as `false`, hiding active drivers).
  @IsOptional()
  @IsBooleanString()
  active?: string;
}
