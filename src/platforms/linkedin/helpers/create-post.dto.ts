import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateLinkedInPostDto {
  @IsString()
  @MaxLength(3000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}
