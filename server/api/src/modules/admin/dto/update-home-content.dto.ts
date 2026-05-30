import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHomeContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  marquee_text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  story_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  story_body?: string;
}
