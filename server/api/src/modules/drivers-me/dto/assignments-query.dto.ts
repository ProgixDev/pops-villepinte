import { IsIn, IsOptional } from 'class-validator';

export class AssignmentsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'accepted', 'refused', 'cancelled'])
  status?: 'pending' | 'accepted' | 'refused' | 'cancelled';
}
