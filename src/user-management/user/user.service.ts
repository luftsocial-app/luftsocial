import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { TenantService } from '../tenant/tenant.service';
import { clerkClient, User as clerkUser } from '@clerk/express';
import { UserRole } from '../../common/enums/roles';
import {
  UserWebhookEvent,
  OrganizationMembershipWebhookEvent,
} from '@clerk/express';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly tenantService: TenantService,
  ) {}

  async getUsers(): Promise<clerkUser[]> {
    const users = await clerkClient.users.getUserList();
    return users.data;
  }

  async findUser(clerkId: string) {
    return this.userRepo.findOne({
      where: {
        clerkId,
        activeTenantId: this.tenantService.getTenantId(),
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

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    Object.assign(user, userData);
    return await this.userRepo.save(user);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    await this.userRepo.remove(user);
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async getUserByFirstName(firstName: string): Promise<User[]> {
    const users = await this.userRepo.find({
      where: { firstName },
    });
    if (users.length === 0) {
      throw new BadRequestException('User not found');
    }
    return users;
  }

  async getUserByLastName(lastName: string): Promise<User[]> {
    const users = await this.userRepo.find({
      where: { lastName },
    });
    if (users.length === 0) {
      throw new BadRequestException('User not found');
    }
    return users;
  }

  async handleUserCreation(userCreatedData: UserWebhookEvent): Promise<User> {
    const userObject = {
      id: userCreatedData.data.id,
      clerkId: userCreatedData.data.id,
      email: userCreatedData.data['email_addresses'][0]['email_address'] || '',
      username:
        userCreatedData.data['email_addresses'][0]['email_address'] || '',
      firstName: userCreatedData.data['first_name'] || '',
      lastName: userCreatedData.data['last_name'] || '',
      activeTenantId: userCreatedData.data['tenant_id'] || '',
    };

    const user = this.userRepo.create(userObject);
    return await this.userRepo.save(user);
  }

  async handleUserUpdate(userUpdatedData: UserWebhookEvent): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userUpdatedData.data.id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    Object.assign(user, {
      email:
        userUpdatedData.data['email_addresses'][0]['email_address'] ||
        user.email,
      username:
        userUpdatedData.data['email_addresses'][0]['email_address'] ||
        user.username,
      firstName: userUpdatedData.data['first_name'] || user.firstName,
      lastName: userUpdatedData.data['last_name'] || user.lastName,
    });

    return await this.userRepo.save(user);
  }

  async handleMembershipCreated(
    membershipCreatedData: OrganizationMembershipWebhookEvent,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: membershipCreatedData.data['public_user_data']['user_id'] },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.activeTenantId = membershipCreatedData.data['organization'].id;
    await this.userRepo.save(user);
  }

  async handleMembershipDeleted(
    membershipDeletedData: UserWebhookEvent,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: membershipDeletedData.data.id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.activeTenantId = null;
    await this.userRepo.save(user);
  }

  async handleMembershipUpdated(
    membershipUpdatedData: UserWebhookEvent,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: membershipUpdatedData.data.id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.activeTenantId = membershipUpdatedData.data['tenant_id'];
    await this.userRepo.save(user);
  }
}
