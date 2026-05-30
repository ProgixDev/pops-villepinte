import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class DayHours {
  @IsBoolean()
  closed: boolean;

  // HH:mm 00:00–23:59 — empty allowed only when closed.
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'open must be HH:mm',
  })
  open: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'close must be HH:mm',
  })
  close: string;
}

export class HoursByDayDto {
  @ValidateNested() @Type(() => DayHours) mon: DayHours;
  @ValidateNested() @Type(() => DayHours) tue: DayHours;
  @ValidateNested() @Type(() => DayHours) wed: DayHours;
  @ValidateNested() @Type(() => DayHours) thu: DayHours;
  @ValidateNested() @Type(() => DayHours) fri: DayHours;
  @ValidateNested() @Type(() => DayHours) sat: DayHours;
  @ValidateNested() @Type(() => DayHours) sun: DayHours;
}

export class UpdateShopSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  open_days?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  open_hours?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HoursByDayDto)
  hours_by_day?: HoursByDayDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  delivery_base_fee_eur?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  delivery_per_km_eur?: number;

  // Superadmin support phone surfaced to drivers. Empty string clears it.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  support_phone?: string;
}
