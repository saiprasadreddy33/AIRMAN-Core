import { IsDateString } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsDateString()
  start_time?: string;

  @IsDateString()
  end_time?: string;
}
