import { IsDateString } from 'class-validator';

export class CreateAvailabilityDto {
  @IsDateString()
  start_time: string;

  @IsDateString()
  end_time: string;
}
