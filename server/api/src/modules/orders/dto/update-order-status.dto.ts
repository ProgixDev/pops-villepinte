import { IsIn, IsString } from 'class-validator';
import { OrderStatus } from '../../../shared/types';

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['preparing', 'ready', 'handed_to_livreur', 'picked_up'])
  status: OrderStatus;
}
