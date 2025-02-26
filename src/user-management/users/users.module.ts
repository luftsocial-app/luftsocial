import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../entities/users/user.entity';
import { Role } from '../../entities/roles/role.entity';
import { TenantAwareRepoModule } from '../../tenant-aware-repo/tenant-aware-repo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    TenantAwareRepoModule.forFeature([User, Role]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
