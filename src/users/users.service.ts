import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../types/enums';
import {
  TenantAwareRepository,
  createTenantAwareRepository,
} from '../database/tenant-aware.repository';

@Injectable()
export class UsersService {
  private readonly tenantAwareUserRepository: TenantAwareRepository<User>;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {
    // Initialize tenant-aware repository
    this.tenantAwareUserRepository = createTenantAwareRepository(
      this.userRepository.manager.connection,
      User,
    );
  }

  // New helper method to reduce repeated code
  private async findOneByQuery(
    query: object,
    tenantId: string,
  ): Promise<User | null> {
    this.tenantAwareUserRepository.setTenantId(tenantId);
    return await this.tenantAwareUserRepository.findOne({ where: query });
  }

  async syncClerkUser(
    clerkId: string,
    tenantId: string,
    currentUserData: Partial<User>,
  ): Promise<User> {
    let user = await this.findOneByQuery({ clerkId }, tenantId);
    if (!user) {
      const defaultRole = await this.roleRepository.findOne({
        where: { name: UserRole.MEMBER },
      });

      if (!defaultRole) {
        throw new BadRequestException('Default role not found');
      }

      user = this.userRepository.create({
        clerkId,
        email: currentUserData.email || '',
        firstName: currentUserData.firstName || '',
        lastName: currentUserData.lastName || '',
        organizationId: tenantId,
        roles: [defaultRole],
      });
    } else {
      // Update properties from current user data
      user.email = currentUserData.email ?? user.email;
      user.firstName = currentUserData.firstName ?? user.firstName;
      user.lastName = currentUserData.lastName ?? user.lastName;
      // Update roles if provided (expects an array of Role objects)
      if (currentUserData.roles) {
        user.roles = currentUserData.roles;
      }
    }
    return await this.userRepository.save(user);
  }

  async getOrganizationUsers(tenantId: string): Promise<User[]> {
    try {
      this.tenantAwareUserRepository.setTenantId(tenantId);
      return await this.tenantAwareUserRepository.find({
        where: { organizationId: tenantId },
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
      const user = await this.findOneByQuery(
        { id: userId, organizationId: tenantId },
        tenantId,
      );
      if (!user) {
        throw new BadRequestException('User not found in organization');
      }

      const roleEntities = await this.roleRepository.find({
        where: roles.map((role) => ({ name: role })),
      });
      if (roleEntities.length !== roles.length) {
        throw new BadRequestException('One or more roles not found');
      }

      user.roles = roleEntities;
      return await this.userRepository.save(user);
    } catch (error) {
      throw new BadRequestException(
        `Failed to update user role: ${error.message}`,
      );
    }
  }

  async findUser(clerkId: string, tenantId: string): Promise<User | null> {
    try {
      this.tenantAwareUserRepository.setTenantId(tenantId);
      return await this.tenantAwareUserRepository.findOne({
        where: { clerkId, organizationId: tenantId },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to find user: ${error.message}`);
    }
  }
}
