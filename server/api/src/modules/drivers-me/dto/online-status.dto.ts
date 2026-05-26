import { IsBoolean } from 'class-validator';

export class OnlineStatusDto {
  @IsBoolean()
  is_active!: boolean;
}
