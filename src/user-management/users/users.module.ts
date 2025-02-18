import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../entities/users/user.entity';
import { Role } from '../../entities/roles/role.entity';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), DatabaseModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
