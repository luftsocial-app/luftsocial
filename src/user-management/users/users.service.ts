import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../entities/users/user.entity';
import { Role } from '../../entities/roles/role.entity';
import { clerkClient, User as clerkUser } from '@clerk/express';
import { UserRole } from '../../common/enums/roles';

@Injectable()
export class UsersService {
  constructor(
    @Inject(`TENANT_AWARE_REPOSITORY_${User.name}`)
    private readonly userRepo: Repository<User>,
    @Inject(`TENANT_AWARE_REPOSITORY_${Role.name}`)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async getUsers(): Promise<clerkUser[]> {
    const users = await clerkClient.users.getUserList();
    return users.data;
  }

  async findUser(clerkId: string) {
    return this.userRepo.findOne({
      where: {
        clerkId,
        activeTenantId: 'tenantId',
      },
      relations: ['roles'],
    });
  }

  async syncClerkUser(
    clerkId: string,
    tenantId: string,
    userData: Partial<User>,
  ) {
    let user = await this.findUser(clerkId);
    if (!user) {
      const defaultRole = await this.roleRepo.findOne({
        where: { name: UserRole.MEMBER },
      });

      if (!defaultRole) throw new BadRequestException('Default role not found');

      user = this.userRepo.create({
        clerkId,
        email: userData.email || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        activeTenantId: tenantId,
        roles: [defaultRole],
      });
    } else {
      Object.assign(user, {
        email: userData.email ?? user.email,
        firstName: userData.firstName ?? user.firstName,
        lastName: userData.lastName ?? user.lastName,
        roles: userData.roles ?? user.roles,
      });
    }

    return this.userRepo.save(user);
  }

  async getTenantUsers(tenantId: string): Promise<User[]> {
    try {
      return await this.userRepo.find({
        where: { activeTenantId: tenantId },
        order: {
          firstName: 'ASC',
          lastName: 'ASC',
        },
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch Tenant users: ${error.message}`,
      );
    }
  }

  async updateUserRole(
    userId: string,
    roles: UserRole[],
    tenantId: string,
  ): Promise<User> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId, activeTenantId: tenantId },
        relations: ['roles'],
      });
      if (!user) {
        throw new BadRequestException('User not found in Tenant');
      }

      const roleEntities = await this.roleRepo.find({
        where: roles.map((role) => ({ name: role })),
      });
      if (roleEntities.length !== roles.length) {
        throw new BadRequestException('One or more roles not found');
      }

      user.roles = roleEntities;
      return await this.userRepo.save(user);
    } catch (error) {
      throw new BadRequestException(
        `Failed to update user role: ${error.message}`,
      );
    }
  }
}
