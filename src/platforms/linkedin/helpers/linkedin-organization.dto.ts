import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinkedInOrganizationDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  vanityName?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
