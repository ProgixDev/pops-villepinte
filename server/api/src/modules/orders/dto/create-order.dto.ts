import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';
import { MAX_ITEMS_PER_ORDER } from '../../../shared/constants';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  customerName: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS_PER_ORDER)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // Delivery option — when omitted, default to pickup. The service performs the
  // cross-field validation (address+coords required for delivery, forbidden for
  // pickup) so the user gets a clean error rather than a 400 wall.
  @IsOptional()
  @IsIn(['pickup', 'delivery'])
  pickupMode?: 'pickup' | 'delivery';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryAddress?: string;

  @IsOptional()
  @IsLatitude()
  deliveryLat?: number;

  @IsOptional()
  @IsLongitude()
  deliveryLng?: number;
}
