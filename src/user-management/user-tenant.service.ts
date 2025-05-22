import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Tenant } from './entities/tenant.entity';
import { PinoLogger } from 'nestjs-pino';
import {
  ITenantUserOperation,
  IOperationResult,
} from './interfaces/tenant-user.interface';

@Injectable()
export class UserTenantService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserTenantService.name);
  }

  async executeOperation(
    operation: ITenantUserOperation,
  ): Promise<IOperationResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { userId, tenantId, operationType, userData } = operation;

      const tenant = await queryRunner.manager.findOne(Tenant, {
        where: { id: tenantId },
        relations: ['users'],
        // lock: { mode: 'pessimistic_write' },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      let user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        relations: ['tenants'],
      });

      switch (operationType) {
        case 'ADD':
          user = await this.addMembership(user, tenant, userData, queryRunner);
          break;
        case 'UPDATE':
          user = await this.updateMembership(
            user,
            tenant,
            userData,
            queryRunner,
          );
          break;
        case 'REMOVE':
          user = await this.deleteMembership(user, tenantId, queryRunner);
          break;
        default:
          this.logger.error('Invalid operation type');
          throw new Error('Invalid operation type');
      }

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: `Successfully executed ${operationType} operation`,
        data: user,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Operation failed: ${error.message}`);
      return { success: false, message: error.message, error };
    } finally {
      await queryRunner.release();
    }
  }

  private async addMembership(
    user: User | null,
    tenant: Tenant,
    userData: any,
    queryRunner: any,
  ): Promise<User> {
    if (!user) {
      // Create new user if doesn't exist
      user = this.userRepo.create({
        id: userData.id,
        clerkId: userData.clerkId || userData.id,
        email: userData.email || '',
        username: userData.email || userData.firstName,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        tenants: [],
        activeTenantId: tenant.id,
      });
    }

    // Now save/update the user
    if (!user.tenants) user.tenants = [];
    if (!user.tenants.find((t) => t.id === tenant.id)) {
      user.tenants.push(tenant);
    }

    // Set activeTenantId only if it's currently null or empty
    if (!user.activeTenantId) {
      user.activeTenantId = tenant.id;
      this.logger.info(
        { userId: user.id, newActiveTenantId: tenant.id },
        'User activeTenantId was null, setting it to the newly added tenant.',
      );
    }

    return await queryRunner.manager.save(User, user);
  }

  private async updateMembership(
    user: User,
    tenant: Tenant,
    userData: any,
    queryRunner: any,
  ): Promise<User> {
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, {
      email: userData.email || user.email,
      firstName: userData.firstName || user.firstName,
      lastName: userData.lastName || user.lastName,
      activeTenantId: userData.activeTenantId || user.activeTenantId,
    });

    if (!user.tenants.find((t) => t.id === tenant.id)) {
      user.tenants.push(tenant);
    }
    return await queryRunner.manager.save(User, user);
  }

  private async deleteMembership(
    user: User,
    tenantId: string,
    queryRunner: any,
  ): Promise<User> {
    if (!user) throw new Error('User not found');

    user.tenants = user.tenants.filter((t) => t.id !== tenantId);
    if (user.activeTenantId === tenantId) {
      user.activeTenantId = user.tenants[0]?.id || null;
    }
    return await queryRunner.manager.save(User, user);
  }
}
