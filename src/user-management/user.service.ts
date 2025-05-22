import {
  Injectable,
  BadRequestException,
  Inject,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity'; // Local User entity
import { Role } from './entities/role.entity';
import { ClerkClient, User as ClerkUserType } from '@clerk/backend'; // Explicitly use ClerkUser from backend
import { UserRole } from '../common/enums/roles';
import { UserWebhookEvent } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';
import { CLERK_CLIENT } from '../clerk/clerk.provider';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';
import { UserWithLocalRoles } from './dtos/user-with-local-roles.dto';
import { ClerkUserWithLocalRelations } from './dtos/clerk-user-with-local-relations.dto'; // Import the new DTO

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
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
  ) {
    this.logger.setContext(UserService.name);
  }

  async getUsers(): Promise<ClerkUserType[]> { // Updated to use ClerkUserType
    // Assuming clerkClient here refers to the global one if not using this.clerkClient for this specific call
    const users = await this.clerkClient.users.getUserList();
    return users.data;
  }

  async getClerkUserWithLocalRolesById(
    id: string,
  ): Promise<UserWithLocalRoles | null> {
    this.logger.info({ userId: id }, 'Fetching user from Clerk by ID');
    let clerkUser: ClerkUserType;
    try {
      clerkUser = await this.clerkClient.users.getUser(id);
    } catch (error) {
      if (error.status === 404 || (error.errors && error.errors[0]?.code === 'resource_not_found')) { // common Clerk error codes
        this.logger.warn({ userId: id, error }, 'User not found in Clerk');
        return null;
      }
      this.logger.error({ userId: id, error }, 'Error fetching user from Clerk');
      throw new InternalServerErrorException(
        `Error fetching user from Clerk: ${error.message}`,
      );
    }

    this.logger.info({ userId: id }, 'Fetching local user record for roles');
    const localUser = await this.userRepo.findOne({
      where: { id: clerkUser.id }, // Use clerkUser.id which is the same as the input 'id'
      relations: ['roles'],
    });

    const userWithRoles: UserWithLocalRoles = {
      ...clerkUser,
      localRoles: localUser?.roles || [], // Default to empty array if no local user or no roles
    };

    return userWithRoles;
  }

  async getClerkUserWithLocalRelationsById(
    userId: string,
  ): Promise<ClerkUserWithLocalRelations | null> {
    this.logger.info({ userId }, 'Fetching user with local relations from Clerk by ID');
    let clerkUser: ClerkUserType;
    try {
      clerkUser = await this.clerkClient.users.getUser(userId);
    } catch (error) {
      if (error.status === 404 || (error.errors && error.errors[0]?.code === 'resource_not_found')) {
        this.logger.warn({ userId, error }, 'User not found in Clerk');
        return null;
      }
      this.logger.error(
        { userId, error },
        'Error fetching user from Clerk',
      );
      throw new InternalServerErrorException(
        `Error fetching user from Clerk: ${error.message}`,
      );
    }

    this.logger.info(
      { userId },
      'Fetching local user record for roles and tenants',
    );
    const localUser = await this.userRepo.findOne({
      where: { id: clerkUser.id },
      relations: ['roles', 'tenants'],
    });

    const userWithFullRelations: ClerkUserWithLocalRelations = {
      ...clerkUser,
      localRoles: localUser?.roles || [],
      localTenants: localUser?.tenants || [],
    };

    return userWithFullRelations;
  }

  async syncClerkUser(
    clerkId: string,
    tenantId: string,
    userData: Partial<User>,
  ) {
    // If this.findById was the old method, it needs to be updated or this method re-evaluated.
    // For now, assuming it means fetching the local entity with its relations.
    // This method might be redundant if getClerkUserWithLocalRolesById serves a similar purpose for combined data.
    // If it's purely for the local entity, it's fine.
    let user = await this.userRepo.findOne({ // Direct local find, assuming this is intended
      where: { id: clerkId },
      relations: ['roles'] // Assuming 'tenants' relation might be needed elsewhere or handled differently
    });
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

  async getTenantUsers(tenantId: string): Promise<ClerkUserType[]> { // Updated to use ClerkUserType
    this.logger.info({ tenantId }, 'Fetching users for tenant from Clerk');
    try {
      const memberships =
        await this.clerkClient.organizations.getOrganizationMembershipList({
          organizationId: tenantId,
          limit: 200, // Added a limit as per considerations
        });

      if (!memberships || memberships.data.length === 0) {
        this.logger.info(
          { tenantId },
          'No memberships found for tenant in Clerk',
        );
        return [];
      }

      const userIds = memberships.data
        .map((membership) => membership.publicUserData?.userId)
        .filter((id): id is string => !!id);

      if (userIds.length === 0) {
        this.logger.info(
          { tenantId },
          'No user IDs extracted from memberships',
        );
        return [];
      }

      // Fetch user details from Clerk
      // Note: Clerk's getUserList can take an array of user IDs.
      // The SDK might handle batching or URL length limits internally.
      // For very large numbers of users, further pagination/batching might be needed.
      const users = await this.clerkClient.users.getUserList({
        userId: userIds,
        limit: userIds.length, // Ensure we attempt to fetch all identified users
      });

      this.logger.info(
        { tenantId, userCount: users.data.length },
        'Successfully fetched users from Clerk',
      );
      return users.data;
    } catch (error) {
      this.logger.error(
        { error, tenantId },
        'Failed to fetch tenant users from Clerk',
      );
      // It's better to throw a more generic server error unless it's a specific client fault
      throw new InternalServerErrorException(
        `Failed to fetch tenant users from Clerk: ${error.message}`,
      );
    }
  }

  async updateUserRole(
    userId: string,
    roleNames: UserRole[], // Renamed from roles to roleNames for clarity
  ): Promise<UserWithLocalRoles | null> {
    this.logger.info({ userId, roleNames }, 'Attempting to update user roles globally');

    // a. Validate User via Clerk
    let clerkUser: ClerkUserType;
    try {
      clerkUser = await this.clerkClient.users.getUser(userId);
      this.logger.info({ userId }, 'User successfully fetched from Clerk');
    } catch (error) {
      if (error.status === 404 || (error.errors && error.errors[0]?.code === 'resource_not_found')) {
        this.logger.warn({ userId, error }, 'User not found in Clerk');
        throw new NotFoundException(`User with ID ${userId} not found in Clerk.`);
      }
      this.logger.error({ userId, error }, 'Error fetching user from Clerk');
      throw new InternalServerErrorException(
        `Error fetching user from Clerk: ${error.message}`,
      );
    }

    // b. Fetch Local User
    this.logger.info({ userId }, 'Fetching local user record');
    const localUser = await this.userRepo.findOne({
      where: { id: userId }, // Removed activeTenantId filter
      relations: ['roles'],
    });

    if (!localUser) {
      this.logger.warn({ userId }, 'Local user record not found. Cannot update roles.');
      // This case might indicate a desynchronization or an incomplete local profile.
      // Depending on business logic, one might create the local user here,
      // but the current instruction is to throw NotFoundException.
      throw new NotFoundException(
        `Local user record for ID ${userId} not found. Cannot update roles.`,
      );
    }
    this.logger.info({ userId }, 'Local user record found');

    // c. Fetch Role Entities
    this.logger.info({ userId, roleNames }, 'Fetching role entities from DB');
    const roleEntities = await this.roleRepo.find({
      where: roleNames.map((roleName) => ({ name: roleName })),
    });

    if (roleEntities.length !== roleNames.length) {
      const foundRoleNames = roleEntities.map((r) => r.name);
      const notFoundRoleNames = roleNames.filter(
        (rn) => !foundRoleNames.includes(rn),
      );
      this.logger.warn(
        { userId, notFoundRoleNames },
        'One or more roles not found in DB',
      );
      throw new BadRequestException(
        `The following roles were not found: ${notFoundRoleNames.join(', ')}`,
      );
    }
    this.logger.info({ userId, roleNames }, 'All role entities found');

    // d. Update and Save
    localUser.roles = roleEntities;
    await this.userRepo.save(localUser);
    this.logger.info({ userId, roleNames }, 'Successfully updated user roles in DB');

    // e. Return Value
    const userWithLocalRoles: UserWithLocalRoles = {
      ...clerkUser, // Spread properties from the authoritative Clerk user object
      localRoles: localUser.roles, // Add the updated local roles
    };

    return userWithLocalRoles;
  }

  async createUser(userCreatedData: UserWebhookEvent): Promise<User> {
    const userId = userCreatedData.data.id;
    this.logger.info({ userId }, 'Processing createUser event');

    const existingUser = await this.userRepo.findOne({ where: { id: userId } });
    if (existingUser) {
      this.logger.info(
        { userId },
        'User already exists. Skipping creation. Returning existing user.',
      );
      return existingUser;
    }

    const userObject = {
      id: userId,
      clerkId: userId,
      email: userCreatedData.data['email_addresses'][0]['email_address'] || '',
      username:
        userCreatedData.data['email_addresses'][0]['email_address'] || '',
      firstName: userCreatedData.data['first_name'] || '',
      lastName: userCreatedData.data['last_name'] || '',
      // activeTenantId is intentionally removed as per requirements
    };

    this.logger.info({ userId }, 'Creating new user in DB');
    const user = this.userRepo.create(userObject);
    return await this.userRepo.save(user);
  }

  async updateUser(userUpdatedData: UserWebhookEvent): Promise<User> {
    const userId = userUpdatedData.data.id;
    let user = await this.userRepo.findOne({
      where: { id: userId },
    });

    this.logger.info({ userId, userExists: !!user }, 'Processing updateUser event');

    if (!user) {
      this.logger.info({ userId }, 'User not found. Attempting to create new user from updateUser event.');
      // It's possible a user.updated event arrives for a user not yet created due to eventual consistency
      // or if user.created event was missed.
      const userObject = {
        id: userId,
        clerkId: userId,
        email:
          userUpdatedData.data['email_addresses'][0]['email_address'] || '',
        username:
          userUpdatedData.data['email_addresses'][0]['email_address'] || '',
        firstName: userUpdatedData.data['first_name'] || '',
        lastName: userUpdatedData.data['last_name'] || '',
        // activeTenantId is intentionally removed as per requirements
      };

      this.logger.info({ userId }, 'Creating new user (from updateUser) in DB');
      const newUser = this.userRepo.create(userObject);
      user = await this.userRepo.save(newUser); // Assign to user to be returned
      this.logger.info({ userId }, 'User created successfully from updateUser event');
      return user;
    }

    // Existing user found, proceed with update
    this.logger.info({ userId }, 'User found. Updating existing user.');
    Object.assign(user, {
      email:
        userUpdatedData.data['email_addresses'][0]['email_address'] ||
        user.email,
      username:
        userUpdatedData.data['email_addresses'][0]['email_address'] ||
        user.username,
      firstName: userUpdatedData.data['first_name'] || user.firstName,
      lastName: userUpdatedData.data['last_name'] || user.lastName,
      // activeTenantId is not managed here
    });

    return await this.userRepo.save(user);
  }

  async deleteUser(userDeletedData: UserWebhookEvent): Promise<void> {
    const userId = userDeletedData.data.id;
    this.logger.info({ userId }, 'Processing deleteUser event');
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(
        { userId },
        'User not found. Skipping deletion.',
      );
      return;
    }

    this.logger.info({ userId }, 'Deleting user from DB');
    await this.userRepo.remove(user);
  }
}
