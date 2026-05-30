import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportProblemDto {
  @IsString()
  @MaxLength(60)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
