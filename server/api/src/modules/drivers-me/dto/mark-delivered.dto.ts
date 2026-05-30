import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkDeliveredDto {
  // 'qr' = the driver scanned the customer's QR (code required + verified).
  // 'manual' = "confirmer sans QR" fallback (logged as delivered_method).
  @IsIn(['qr', 'manual'])
  method: 'qr' | 'manual';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}
