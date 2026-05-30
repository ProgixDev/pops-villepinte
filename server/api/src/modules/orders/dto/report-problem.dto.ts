import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class ReportProblemDto {
  @IsString()
  @MaxLength(60)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Public URLs of photos the customer attached, already uploaded by the app to
  // the `ticket-attachments` bucket. We cap the count so a single report can't
  // balloon the row, and validate each is a real URL.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
