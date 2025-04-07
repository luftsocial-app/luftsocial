import { Injectable } from '@nestjs/common';
import { User } from '../../user-management/entities/user.entity';
import { UserWebhookEvent } from '@clerk/express';
import {
  OrganizationWebhookEvent,
  OrganizationMembershipWebhookEvent,
} from '@clerk/express';
import { TenantService } from '../../user-management/tenant/tenant.service';
import { UserService } from '../../user-management/user/user.service';

@Injectable()
export class ClerkWebhookService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly userService: UserService,
  ) {}

  async createUser(userCreatedData: UserWebhookEvent): Promise<User> {
    return this.userService.handleUserCreation(userCreatedData);
  }

  async updateUser(userUpdatedData: UserWebhookEvent): Promise<User> {
    return this.userService.handleUserUpdate(userUpdatedData);
  }

  async tenantCreated(createOrgData: OrganizationWebhookEvent): Promise<void> {
    await this.tenantService.handleTenantCreation(createOrgData);
  }

  async tenantUpdated(updateOrgData: OrganizationWebhookEvent): Promise<void> {
    await this.tenantService.handleTenantUpdate(updateOrgData);
  }

  async tenantDeleted(deleteOrgData: OrganizationWebhookEvent): Promise<void> {
    await this.tenantService.handleTenantDeletion(deleteOrgData);
  }

  async membershipCreated(
    membershipCreatedData: OrganizationMembershipWebhookEvent,
  ): Promise<void> {
    await this.userService.handleMembershipCreated(membershipCreatedData);
  }

  async membershipDeleted(
    membershipDeletedData: UserWebhookEvent,
  ): Promise<void> {
    await this.userService.handleMembershipDeleted(membershipDeletedData);
  }

  async membershipUpdated(
    membershipUpdatedData: UserWebhookEvent,
  ): Promise<void> {
    await this.userService.handleMembershipUpdated(membershipUpdatedData);
  }
}
