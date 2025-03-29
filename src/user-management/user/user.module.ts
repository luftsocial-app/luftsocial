import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), TenantModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
