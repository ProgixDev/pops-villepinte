import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateLoyaltySettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  habitue_min?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  vip_min?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  legende_min?: number;
}
