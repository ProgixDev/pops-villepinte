import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShopSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  open_days?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  open_hours?: string;
}
