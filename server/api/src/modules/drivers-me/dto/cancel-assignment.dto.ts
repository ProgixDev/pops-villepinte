import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAssignmentDto {
  // Why the driver cancelled — e.g. "Client absent". Stored on the assignment
  // so the superadmin can see the reason. Optional but encouraged by the app.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
