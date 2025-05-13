import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPostDto {
  @IsNotEmpty()
  @IsString()
  comment: string;
}
