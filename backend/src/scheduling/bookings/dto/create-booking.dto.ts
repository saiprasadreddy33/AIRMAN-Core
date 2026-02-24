import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  instructor_id: string;

  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsDateString()
  start_time: string;

  @IsDateString()
  end_time: string;
}
