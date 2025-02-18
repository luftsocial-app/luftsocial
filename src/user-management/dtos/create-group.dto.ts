import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'The name of the group',
    example: 'Development Team',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'The description of the group',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'The Tenant ID',
    example: 'org_123456',
  })
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}
