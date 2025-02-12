import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { TenantService } from '../../database/tenant.service';
import { clerkClient, User as clerkUser } from '@clerk/express';
import { UserRole } from '../../common/enums/roles';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly tenantService: TenantService,
  ) {}

  async getUsers(): Promise<clerkUser[]> {
    const users = await clerkClient.users.getUserList();
    console.log({ users: users.data });
    return users.data;
  }

  async findUser(clerkId: string) {
    return this.userRepo.findOne({
      where: {
        clerkId,
        activeOrganizationId: this.tenantService.getTenantId(),
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
        activeOrganizationId: tenantId,
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

  async getOrganizationUsers(tenantId: string): Promise<User[]> {
    try {
      return await this.userRepo.find({
        where: { activeOrganizationId: tenantId },
        order: {
          firstName: 'ASC',
          lastName: 'ASC',
        },
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch organization users: ${error.message}`,
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
        where: { id: userId, activeOrganizationId: tenantId },
        relations: ['roles'],
      });
      if (!user) {
        throw new BadRequestException('User not found in organization');
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
