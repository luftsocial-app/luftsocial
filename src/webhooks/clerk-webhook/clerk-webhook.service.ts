import { Injectable, BadRequestException } from '@nestjs/common';
import { User } from '../../user-management/entities/user.entity';
import {
  UserWebhookEvent,
  OrganizationMembershipWebhookEvent,
  OrganizationWebhookEvent,
  WebhookEvent,
} from '@clerk/express';
import {} from '@clerk/express';
import { UserTenantService } from '../../user-management/user-tenant.service';
import { PinoLogger } from 'nestjs-pino';
import { Webhook } from 'svix';
import { UserService } from '../../user-management/user.service';
import { TenantService } from '../../user-management/tenant.service';

@Injectable()
export class ClerkWebhookService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly userService: UserService,
    private readonly tenantUserManager: UserTenantService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ClerkWebhookService.name);
  }

  async verifyWebhook(payload: any, headers: any): Promise<WebhookEvent> {
    const SIGNING_SECRET = process.env.SIGNING_SECRET;
    if (!SIGNING_SECRET) {
      throw new Error('Missing SIGNING_SECRET');
    }

    const wh = new Webhook(SIGNING_SECRET);
    const svix_id = headers['svix-id'];
    const svix_timestamp = headers['svix-timestamp'];
    const svix_signature = headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      throw new BadRequestException('Missing Svix headers');
    }

    try {
      return wh.verify(JSON.stringify(payload), {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      this.logger.error('Invalid webhook signature', err);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    this.logger.info(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'user.created':
        await this.handleUserCreated(event);
        break;
      case 'user.updated':
        await this.handleUserUpdated(event);
        break;
      case 'user.deleted':
        await this.handleUserDeleted(event);
        break;
      case 'organization.created':
        await this.handleTenantCreated(event);
        break;
      case 'organization.updated':
        await this.handleTenantUpdated(event);
        break;
      case 'organization.deleted':
        await this.handleTenantDeleted(event);
        break;
      case 'organizationMembership.created':
        await this.handleMembershipCreated(event);
        break;
      case 'organizationMembership.updated':
        await this.handleMembershipUpdated(event);
        break;
      case 'organizationMembership.deleted':
        await this.handleMembershipDeleted(event);
        break;
      default:
        this.logger.warn(`Unhandled webhook event type: ${event.type}`);
    }
  }

  async handleUserCreated(userCreatedData: UserWebhookEvent): Promise<User> {
    this.logger.info('Processing user.created event', {
      userId: userCreatedData.data.id,
    });
    return this.userService.createUser(userCreatedData);
  }

  async handleUserUpdated(userUpdatedData: UserWebhookEvent): Promise<User> {
    this.logger.info('Processing user.updated event', {
      userId: userUpdatedData.data.id,
    });

    return this.userService.updateUser(userUpdatedData);
  }

  async handleUserDeleted(userDeletedData: UserWebhookEvent): Promise<void> {
    this.logger.info('Processing user.deleted event', {
      userId: userDeletedData.data.id,
    });
    await this.userService.deleteUser(userDeletedData);
  }

  async handleTenantCreated(
    tenantCreatedEvent: OrganizationWebhookEvent,
  ): Promise<void> {
    this.logger.info('Processing organization.created event', {
      tenantId: tenantCreatedEvent.data.id,
    });
    await this.tenantService.createTenant(tenantCreatedEvent);
  }

  async handleTenantUpdated(
    tenantUpdatedEvent: OrganizationWebhookEvent,
  ): Promise<void> {
    this.logger.info('Processing organization.updated event', {
      tenantId: tenantUpdatedEvent.data.id,
    });
    await this.tenantService.updateTenant(tenantUpdatedEvent);
  }

  async handleTenantDeleted(
    tenantDeletedEvent: OrganizationWebhookEvent,
  ): Promise<void> {
    this.logger.info('Processing organization.deleted event', {
      tenantId: tenantDeletedEvent.data.id,
    });
    await this.tenantService.deleteTenant(tenantDeletedEvent);
  }

  async handleMembershipCreated(
    membershipCreatedEvent: OrganizationMembershipWebhookEvent,
  ): Promise<void> {
    this.logger.info('Processing organizationMembership.created event', {
      userId: membershipCreatedEvent.data.public_user_data?.user_id,
      tenantId: membershipCreatedEvent.data.organization?.id,
    });

    const operation = {
      userId: membershipCreatedEvent.data.public_user_data.user_id,
      tenantId: membershipCreatedEvent.data.organization.id,
      operationType: 'ADD' as const,
      userData: {
        id: membershipCreatedEvent.data.public_user_data.user_id,
        email: membershipCreatedEvent.data.public_user_data.identifier,
        firstName: membershipCreatedEvent.data.public_user_data.first_name,
        lastName: membershipCreatedEvent.data.public_user_data.last_name,
      },
    };

    await this.tenantUserManager.executeOperation(operation);
  }

  async handleMembershipDeleted(
    membershipDeletedEvent: OrganizationMembershipWebhookEvent,
  ): Promise<void> {
    this.logger.info('Processing organizationMembership.deleted event', {
      userId: membershipDeletedEvent.data.public_user_data?.user_id,
      tenantId: membershipDeletedEvent.data.organization?.id,
    });
    const operation = {
      userId: membershipDeletedEvent.data.public_user_data.user_id,
      tenantId: membershipDeletedEvent.data.organization?.id,
      operationType: 'REMOVE' as const,
      userData: {
        activeTenantId: membershipDeletedEvent.data.organization?.id,
      },
    };

    await this.tenantUserManager.executeOperation(operation);
  }

  async handleMembershipUpdated(
    membershipUpdatedEvent: OrganizationMembershipWebhookEvent,
  ): Promise<void> {
    this.logger.info('Processing organizationMembership.updated event', {
      userId: membershipUpdatedEvent.data.public_user_data?.user_id,
      tenantId: membershipUpdatedEvent.data.organization?.id,
    });
    const operation = {
      userId: membershipUpdatedEvent.data.public_user_data.user_id,
      tenantId: membershipUpdatedEvent.data.organization?.id,
      operationType: 'UPDATE' as const,
      userData: {
        activeTenantId: membershipUpdatedEvent.data.organization?.id,
      },
    };

    await this.tenantUserManager.executeOperation(operation);
  }
}
