import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(['open', 'resolved'])
  status?: 'open' | 'resolved';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  admin_notes?: string;
}
