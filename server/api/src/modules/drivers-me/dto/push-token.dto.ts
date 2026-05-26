import { IsString, MaxLength, MinLength } from 'class-validator';

export class PushTokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  expo_push_token!: string;
}
