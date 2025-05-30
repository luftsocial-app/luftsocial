import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Tenant } from './entities/tenant.entity';
import { UserService } from './user.service';
import { UserTenantService } from './user-tenant.service';
import { UserController } from './user.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Tenant])],
  providers: [UserService, TenantService, UserTenantService],
  exports: [UserService, TenantService, UserTenantService],
  controllers: [UserController],
})
export class UserManagementModule {}
