import { IsIn, IsOptional } from 'class-validator';

export class EarningsQueryDto {
  @IsOptional()
  @IsIn(['today', 'week', 'month'])
  period?: 'today' | 'week' | 'month';
}
