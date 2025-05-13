import { IsOptional, IsString } from 'class-validator';

export class ApprovePostDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
