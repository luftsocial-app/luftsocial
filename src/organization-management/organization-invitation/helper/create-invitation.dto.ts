import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  IsUrl,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({
    description: 'The email address of the new member to be invited',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email_address: string;

  @ApiProperty({
    description:
      'The ID of the user that invites the new member (must be an admin)',
    example: 'user_123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  inviter_user_id?: string;

  @ApiProperty({
    description: 'The role of the new member in the organization',
    example: 'org:member',
    enum: ['org:admin', 'org:member'],
  })
  @IsNotEmpty()
  @IsString()
  role: string;

  @ApiProperty({
    description: 'Public metadata for the organization invitation',
    example: { team: 'marketing', title: 'Content Manager' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  public_metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Private metadata for the organization invitation',
    example: { access_level: 2, internal_id: 'EMP-123' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  private_metadata?: Record<string, any>;

  @ApiProperty({
    description: 'URL to redirect the invitee after accepting the invitation',
    example: 'https://your-app.com/onboarding',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  redirect_url?: string;

  @ApiProperty({
    description: 'The number of days the invitation will be valid for (1-365)',
    example: 30,
    required: false,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expires_in_days?: number;
}
