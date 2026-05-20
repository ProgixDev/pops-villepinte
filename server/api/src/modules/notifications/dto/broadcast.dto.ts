import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class BroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(280)
  body: string;

  // Audience is either tier-based or explicit user ids. "all" is allowed via
  // an empty tier array shortcut handled by the service.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['BIENVENUE', 'HABITUE', 'VIP', 'LEGENDE'], { each: true })
  tiers?: ('BIENVENUE' | 'HABITUE' | 'VIP' | 'LEGENDE')[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['all'])
  audience?: 'all';
}

export class RegisterTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';
}
