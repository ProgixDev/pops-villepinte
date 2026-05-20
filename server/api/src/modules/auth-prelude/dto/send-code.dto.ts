import { IsString, Matches } from 'class-validator';

export class SendCodeDto {
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'Invalid phone format' })
  phone!: string;
}
