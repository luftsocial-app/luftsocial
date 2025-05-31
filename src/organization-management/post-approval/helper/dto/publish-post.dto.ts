import { IsOptional } from 'class-validator';

export class PublishPostDto {
  @IsOptional()
  scheduledFor?: Date;
}
