import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { ClerkClientProvider } from '../clerk/clerk.provider';
import { Tenant } from './entities/tenant.entity';
import { UserService } from './user.service';
import { UserTenantService } from './user-tenant.service';
import { UserController } from './user.controller';
import { TenantService } from './tenant.service';
import { Team } from './entities/team.entity'; // Import Team entity
import { TeamService } from './teams/team.service'; // Import TeamService
import { TeamController } from './teams/team.controller'; // Import TeamController

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Tenant, Team])], // Add Team entity
  providers: [
    UserService,
    ClerkClientProvider,
    TenantService,
    UserTenantService,
    TeamService, // Add TeamService
  ],
  exports: [UserService, TenantService, UserTenantService, TeamService], // Export TeamService
  controllers: [UserController, TeamController], // Add TeamController
})
export class UserManagementModule {}
