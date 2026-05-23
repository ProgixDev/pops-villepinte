import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['scooter', 'bike', 'car'])
  vehicle?: 'scooter' | 'bike' | 'car';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  license_plate?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
