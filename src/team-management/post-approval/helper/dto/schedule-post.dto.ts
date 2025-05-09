import { IsNotEmpty, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class SchedulePostDto {
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  scheduledDate: Date;
}
