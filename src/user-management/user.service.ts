import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { clerkClient, User as clerkUser } from '@clerk/express';
import { UserRole } from '../common/enums/roles';
import { UserWebhookEvent } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly tenantService: TenantService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserService.name);
  }

  async getUsers(): Promise<clerkUser[]> {
    const users = await clerkClient.users.getUserList();
    return users.data;
  }

  async findById(id: string) {
    return this.userRepo.findOne({
      where: {
        id,
        tenants: { id: this.tenantService.getTenantId() },
      },
      relations: ['roles'],
    });
  }

  async checkUserInorganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const count = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.organizations', 'organization')
      .where('user.id = :userId', { userId })
      .andWhere('organization.id = :organizationId', { organizationId })
      .getCount();

    return count > 0;
  }

  async findUserWithRelations(userId: string): Promise<User> {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: ['tenants', 'roles'],
    });
  }

  async syncClerkUser(
    clerkId: string,
    tenantId: string,
    userData: Partial<User>,
  ) {
    let user = await this.findById(clerkId);
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

  async createUser(userCreatedData: UserWebhookEvent): Promise<User> {
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

  async updateUser(userUpdatedData: UserWebhookEvent): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userUpdatedData.data.id },
    });

    this.logger.info({ user, userUpdatedData }, 'User data before update');

    if (!user) {
      // add new user if not found
      this.logger.error('User not found');
      const userObject = {
        id: userUpdatedData.data.id,
        clerkId: userUpdatedData.data.id,
        email:
          userUpdatedData.data['email_addresses'][0]['email_address'] || '',
        username:
          userUpdatedData.data['email_addresses'][0]['email_address'] || '',
        firstName: userUpdatedData.data['first_name'] || '',
        lastName: userUpdatedData.data['last_name'] || '',
        activeTenantId: userUpdatedData.data['tenant_id'] || '',
      };

      const newUser = this.userRepo.create(userObject);
      await this.userRepo.save(newUser);

      this.logger.info('User created successfully', newUser);

      return newUser;
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

  async deleteUser(userDeletedData: UserWebhookEvent): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userDeletedData.data.id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepo.remove(user);
  }
}
