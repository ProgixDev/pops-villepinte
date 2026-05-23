import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { OrderStatus } from '../../../shared/types';

export class CustomerOrdersQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['active', 'past'])
  filter?: 'active' | 'past';
}

export class AdminOrdersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'received',
    'preparing',
    'ready',
    'handed_to_livreur',
    'picked_up',
    'cancelled',
  ])
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;
}
