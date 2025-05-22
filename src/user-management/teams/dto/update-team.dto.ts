import { IsString, IsOptional, MaxLength } from 'class-validator';
export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;
}
