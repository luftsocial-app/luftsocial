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

import { UserRole } from '../../common/enums/roles';

// ... other imports

  async handleUserCreated(userCreatedData: UserWebhookEvent): Promise<User> {
    const { data: clerkUserData } = userCreatedData;
    this.logger.info('Processing user.created event', {
      userId: clerkUserData.id,
      email: clerkUserData.email_addresses?.find(e => e.id === clerkUserData.primary_email_address_id)?.email_address,
      organization_memberships: clerkUserData.organization_memberships,
    });

    let tenantIdToSetAsActive: string | null = null;
    let isNewPersonalTenant = false;

    // Check for organization affiliation
    // Clerk's User object might have `organization_memberships` array or direct organization IDs.
    // Let's assume `organization_memberships` is the primary way to check.
    // Also, Clerk sometimes uses `public_metadata` or `private_metadata` for org info,
    // but `organization_memberships` is more standard for direct relations.
    const primaryOrgMembership = clerkUserData.organization_memberships?.find(
        mem => mem.id === clerkUserData.primary_organization_id
    );

    if (primaryOrgMembership && primaryOrgMembership.organization?.id) {
        tenantIdToSetAsActive = primaryOrgMembership.organization.id;
        this.logger.info(
            { userId: clerkUserData.id, tenantId: tenantIdToSetAsActive },
            'User is affiliated with an organization. Setting active tenant to organization ID.',
        );
    } else if (clerkUserData.organization_memberships && clerkUserData.organization_memberships.length > 0) {
        // Fallback if primary_organization_id is not set but memberships exist
        tenantIdToSetAsActive = clerkUserData.organization_memberships[0].organization.id;
        this.logger.info(
            { userId: clerkUserData.id, tenantId: tenantIdToSetAsActive },
            'User has organization memberships, using the first available organization ID as active tenant.',
        );
    } else {
      this.logger.info(
        { userId: clerkUserData.id },
        'User has no organization affiliation. Creating a personal tenant.',
      );
      const personalTenant = await this.tenantService.createPersonalTenant(
        clerkUserData,
      );
      tenantIdToSetAsActive = personalTenant.id;
      isNewPersonalTenant = true;
      this.logger.info(
        { userId: clerkUserData.id, tenantId: tenantIdToSetAsActive },
        'Personal tenant created and will be set as active.',
      );
    }

    if (!tenantIdToSetAsActive) {
      this.logger.error({ userId: clerkUserData.id, clerkUserData }, "Could not determine a tenant ID (organization or personal) for the new user.");
      // This case should ideally not be reached if personal tenant creation works.
      // Throwing an error or handling as per business rules for users without any tenant.
      throw new BadRequestException('Failed to determine or create a tenant for the user.');
    }
    
    // Create the user in our database with the determined activeTenantId
    const newUser = await this.userService.createUser(
      userCreatedData, // Pass the full event as userService.createUser expects it
      tenantIdToSetAsActive,
    );

    // If a new personal tenant was created, assign the user as Admin to this tenant
    if (isNewPersonalTenant && newUser) {
      this.logger.info(
        { userId: newUser.id, tenantId: tenantIdToSetAsActive },
        'Assigning Admin role to user in their new personal tenant.',
      );
      try {
        // Ensure the 'Admin' role is available for this tenant or globally.
        // The updateUserRole method in UserService should handle finding/creating roles.
        // It typically operates on the user's activeTenantId, which is now set.
        await this.userService.updateUserRole(
          newUser.id,
          [UserRole.ADMIN], // Assign 'Admin' role
          tenantIdToSetAsActive, // Explicitly pass tenantId for clarity and safety
        );
        this.logger.info(
          { userId: newUser.id, tenantId: tenantIdToSetAsActive },
          'Admin role assigned successfully to user in personal tenant.',
        );
      } catch (error) {
        this.logger.error(
          { userId: newUser.id, tenantId: tenantIdToSetAsActive, error },
          'Error assigning Admin role to user in personal tenant. Continuing user creation process.',
        );
        // Decide if this error is critical. For now, we log it and continue.
        // The user and tenant are created, but role assignment failed.
        // Manual intervention or a retry mechanism might be needed.
      }
    }
    return newUser;
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
