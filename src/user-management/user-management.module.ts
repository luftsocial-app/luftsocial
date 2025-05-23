import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { ClerkClientProvider } from '../clerk/clerk.provider';
import { Tenant } from './entities/tenant.entity';
import { Team } from './entities/team.entity'; // Added
import { UserService } from './user.service';
import { UserTenantService } from './user-tenant.service';
import { UserController } from './user.controller';
import { TenantService } from './tenant.service';
import { TeamService } from './team.service'; // Added
import { TeamController } from './team.controller'; // Added

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Tenant, Team])], // Team added
  providers: [
    UserService,
    ClerkClientProvider,
    TenantService,
    UserTenantService,
    TeamService, // TeamService added
  ],
  exports: [UserService, TenantService, UserTenantService, TeamService], // TeamService also exported
  controllers: [UserController, TeamController], // TeamController added
})
export class UserManagementModule {}
