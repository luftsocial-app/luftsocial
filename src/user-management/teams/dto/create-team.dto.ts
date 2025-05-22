import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;
}
