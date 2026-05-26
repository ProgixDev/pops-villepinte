import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondAssignmentDto {
  @IsIn(['accepted', 'refused'])
  status!: 'accepted' | 'refused';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
