import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignDriverDto {
  @IsUUID()
  driver_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
