import { IsString, IsNotEmpty } from 'class-validator';
export class AddTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
