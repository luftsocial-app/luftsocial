import { ApiProperty } from '@nestjs/swagger';

export class RolePermission {
  @ApiProperty({
    description: 'The permission name',
    example: 'create:post',
  })
  name: string;

  @ApiProperty({
    description: 'The permission description',
    example: 'Allows creating new posts',
  })
  description: string;
}

export class Role {
  @ApiProperty({
    description: 'The role name',
    example: 'admin',
  })
  name: string;

  @ApiProperty({
    description: 'The role permissions',
    type: [RolePermission],
  })
  permissions: RolePermission[];
}
