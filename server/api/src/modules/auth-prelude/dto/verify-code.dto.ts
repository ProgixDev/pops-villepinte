import { IsString, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'Invalid phone format' })
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}
