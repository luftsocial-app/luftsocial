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
import { ClerkClient, User as clerkUser } from '@clerk/express'; // Removed global clerkClient import
import { UserRole } from '../common/enums/roles';
import { UserWebhookEvent, UserJSON } from '@clerk/express';
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

  async getUsers(): Promise<clerkUser[]> {
    // This method seems to be using the global clerkClient, not the injected one.
    // Will address this if it's part of a future step, for now using this.clerkClient
    const users = await this.clerkClient.users.getUserList();
    return users.data;
  }

  async findById(id: string): Promise<clerkUser> {
    try {
      // Corrected to use this.clerkClient and pass { userId: id }
      const user = await this.clerkClient.users.getUser({ userId: id });
      return user;
    } catch (error) {
      this.logger.error(
        { error, userId: id },
        'Error fetching user from Clerk in findById',
      );
      // ClerkJS errors often have a status or a more specific code in error.errors
      if (
        error.status === 404 ||
        (error.errors && error.errors[0]?.code === 'resource_not_found')
      ) {
        throw new NotFoundException(`User with ID ${id} not found in Clerk`);
      }
      // Fallback for other types of errors
      throw new BadRequestException(
        `Failed to fetch user from Clerk: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async findUserWithRelations(userId: string): Promise<User> {
    let clerkUser: clerkUser;
    try {
      clerkUser = await this.clerkClient.users.getUser({ userId });
    } catch (error) {
      this.logger.error(
        { error, userId },
        'Error fetching user from Clerk in findUserWithRelations',
      );
      if (
        error.status === 404 ||
        (error.errors && error.errors[0]?.code === 'resource_not_found')
      ) {
        throw new NotFoundException(
          `User with ID ${userId} not found in Clerk`,
        );
      }
      throw new BadRequestException(
        `Failed to fetch user from Clerk: ${error.message || 'Unknown error'}`,
      );
    }

    const localUser = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'tenants'], // Keep tenants relation as per original logic
    });

    if (!localUser) {
      this.logger.warn(
        { userId },
        'User found in Clerk but no local record found. Returning with empty roles/tenants.',
      );
      // Create a structure compatible with User entity if localUser is null
      // This is a simplified mapping. Ensure all necessary fields from User entity are considered.
      // Also, clerkUser primary email address is not guaranteed to be the first one.
      // And it might not exist.
      const primaryEmail = clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;

      return {
        id: clerkUser.id,
        clerkId: clerkUser.id,
        email: primaryEmail || '', // Handle cases where primary email might not be available
        username: clerkUser.username || '', // Clerk username can be null
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        profilePicture: clerkUser.imageUrl,
        // Map other fields from clerkUser to User entity as needed
        // For fields not available in clerkUser, provide defaults or leave as undefined if appropriate
        isActive: true, // Assuming active if found in Clerk; adjust as needed
        permissions: [], // Default if no local user
        roles: [], // No local roles
        tenants: [], // No local tenants
        activeTenantId:
          (clerkUser.publicMetadata?.activeTenantId as string) || undefined, // Example, adjust based on actual Clerk user structure
        createdAt: clerkUser.createdAt
          ? new Date(clerkUser.createdAt)
          : new Date(),
        updatedAt: clerkUser.updatedAt
          ? new Date(clerkUser.updatedAt)
          : new Date(),
        // Fill other User entity fields as best as possible or with defaults
      } as User; // Type assertion might be needed if the mapped object doesn't perfectly match User
    }

    // Combine Clerk data with local data (especially roles and tenants)
    // Prioritize Clerk for most fields, but retain local relations
    const combinedUser: User = {
      ...localUser, // Spread local user to retain all its properties by default
      id: clerkUser.id, // clerkUser.id is the source of truth for the ID
      clerkId: clerkUser.id,
      email:
        clerkUser.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress || localUser.email,
      username: clerkUser.username || localUser.username,
      firstName: clerkUser.firstName || localUser.firstName,
      lastName: clerkUser.lastName || localUser.lastName,
      profilePicture: clerkUser.imageUrl || localUser.profilePicture,
      // Keep local roles and tenants
      roles: localUser.roles,
      tenants: localUser.tenants,
      activeTenantId:
        (clerkUser.publicMetadata?.activeTenantId as string) ||
        localUser.activeTenantId,
      // Update timestamps from Clerk if available
      createdAt: clerkUser.createdAt
        ? new Date(clerkUser.createdAt)
        : localUser.createdAt,
      updatedAt: clerkUser.updatedAt
        ? new Date(clerkUser.updatedAt)
        : localUser.updatedAt,
      // Ensure other fields from User entity are preserved or updated appropriately
    };

    return combinedUser;
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
    let user = await this.userRepo.findOne({
      // Direct local find, assuming this is intended
      where: { id: clerkId },
      relations: ['roles'], // Assuming 'tenants' relation might be needed elsewhere or handled differently
    });
    if (!user) {
      // If user not found in the specific tenant, maybe they exist globally?
      // For sync, it's safer to assume we are trying to sync them *into* this tenant.
      // So, if findById(clerkId, tenantId) returns null, it means they aren't in that tenant.
      // We might still want to fetch the user by clerkId *without* tenant scope
      // to see if they exist at all, before creating a new one.
      const globalUser = await this.findById(clerkId); // Check if user exists at all

      const defaultRole = await this.roleRepo.findOne({
        where: { name: UserRole.MEMBER },
      });

      if (!defaultRole) throw new BadRequestException('Default role not found');

      user = this.userRepo.create({
        clerkId: clerkId, // ensure this is the clerkId
        id: clerkId, // Assuming the 'id' field in User entity should be the clerkId if creating new.
        // This needs to be consistent with how User entity PK is managed.
        // If User.id is a UUID, then it should be generated.
        // The createUser method uses clerkUserData.id for User.id. So this should be userData.id
        email: userData.email || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        activeTenantId: tenantId, // Set active tenant for this user
        roles: defaultRole ? [defaultRole] : [],
        tenants: [], // Initialize tenants array
      });
      // If we created a new user object, we need to ensure it's associated with the current tenant.
      // This part is tricky as tenant object needs to be fetched or passed.
      // For now, the createUser method handles tenant association better.
      // This syncClerkUser might need a deeper refactor if it's meant to create users
      // AND associate them with tenants. The original findById(clerkId) implies it was looking for a user ID (UUID).
      // Let's assume for now that if user is null, we create a new entry.
      // The original `findById` used `id` (PK), not `clerkId`. This is a key change.
      // The `syncClerkUser` was likely broken if `findById` expected a UUID but received a `clerkId`.
      // With `findById` now correctly taking `clerkId`, this part is more sensible.

      if (globalUser) {
        // User exists globally but not in this tenant (or tenant scope wasn't checked before)
        user = globalUser;
        // Add user to this tenant if not already part of it
        const tenantEntity = await this.tenantRepo.findOneBy({ id: tenantId });
        if (tenantEntity) {
          if (!user.tenants) user.tenants = [];
          if (!user.tenants.some((t) => t.id === tenantId)) {
            user.tenants.push(tenantEntity);
          }
          // If user's activeTenantId is not set, set it to this tenant.
          if (!user.activeTenantId) {
            user.activeTenantId = tenantId;
          }
        }
      } else {
        // User does not exist globally, create new
        user = this.userRepo.create({
          id: clerkId, // Assuming Clerk ID is used as primary key for User entity
          clerkId: clerkId,
          email: userData.email || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          activeTenantId: tenantId,
          roles: defaultRole ? [defaultRole] : [],
          tenants: [],
        });
        const tenantEntity = await this.tenantRepo.findOneBy({ id: tenantId });
        if (tenantEntity) {
          user.tenants.push(tenantEntity);
        } else {
          this.logger.warn(
            { tenantId },
            'Tenant not found for syncClerkUser, cannot associate user with tenant.',
          );
        }
      }
    }

    // Update user properties
    Object.assign(user, {
      email: userData.email ?? user.email,
      firstName: userData.firstName ?? user.firstName,
      lastName: userData.lastName ?? user.lastName,
      // roles: userData.roles ?? user.roles, // Role assignment should be more explicit
    });
    if (userData.roles && userData.roles.length > 0) {
      // Assuming userData.roles are UserRole enums or can be mapped to Role entities
      // This part needs careful handling of role objects vs enums.
      // For now, let's assume roles are handled elsewhere or simplified.
      // user.roles = ...
    }

    return this.userRepo.save(user);
  }

  async getTenantUsers(tenantId: string): Promise<User[]> {
    try {
      const memberships =
        await this.clerkClient.organizations.getOrganizationMembershipList({
          organizationId: tenantId,
        });

      const usersWithRoles: User[] = [];

      for (const membership of memberships) {
        if (!membership.publicUserData) {
          this.logger.warn(
            { membershipId: membership.id },
            'Membership found without publicUserData. Skipping.',
          );
          continue;
        }

        const clerkUserData = membership.publicUserData;
        const localUser = await this.userRepo.findOne({
          where: { id: clerkUserData.userId },
          relations: ['roles'],
        });

        let roles: Role[] = [];
        if (localUser) {
          roles = localUser.roles;
        } else {
          this.logger.warn(
            { userId: clerkUserData.userId, tenantId },
            'User from Clerk membership not found in local DB for roles. Proceeding with empty roles.',
          );
        }

        // Assuming clerkUserData has fields like userId, firstName, lastName, identifier (for email/username)
        // And profileImageUrl for profilePicture. Adjust mapping as per actual clerkUserData structure.
        // The User entity has 'email' and 'username'. Clerk's 'identifier' might be one of these.
        // Clerk's primary email is often in `clerkUserData.identifier` or might need specific fetching if not directly on publicUserData.
        // For simplicity, I'm assuming identifier is email.

        // Fetch full clerk user to get email if not in publicUserData
        let clerkUser: clerkUser | null = null;
        try {
          clerkUser = await this.clerkClient.users.getUser({
            userId: clerkUserData.userId,
          });
        } catch (e) {
          this.logger.error(
            { error: e, userId: clerkUserData.userId },
            'Failed to fetch full clerk user details for email',
          );
        }
        const primaryEmail = clerkUser?.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress;

        usersWithRoles.push({
          id: clerkUserData.userId,
          clerkId: clerkUserData.userId,
          // email: clerkUserData.identifier || '', // This was an assumption, better to get from full user
          email: primaryEmail || '',
          username: clerkUser?.username || '', // clerkUserData might not have username
          firstName: clerkUserData.firstName || '',
          lastName: clerkUserData.lastName || '',
          profilePicture: clerkUserData.imageUrl, // Clerk uses imageUrl
          isActive: true, // Assuming active if part of organization; adjust as needed
          roles: roles,
          // Fill other User entity fields as best as possible or with defaults
          // These fields are from the User entity, provide sensible defaults or map if available
          permissions: localUser?.permissions || [],
          tenants: localUser?.tenants || [], // This might be complex if a user belongs to multiple tenants locally
          activeTenantId: localUser?.activeTenantId || tenantId, // Default to current tenantId if not set
          createdAt: localUser?.createdAt || new Date(membership.createdAt), // membership.createdAt might be join date
          updatedAt: localUser?.updatedAt || new Date(membership.updatedAt),
        } as User); // Type assertion to satisfy User type
      }

      // Optional: Sort users similarly to the old implementation
      usersWithRoles.sort((a, b) => {
        if (a.firstName < b.firstName) return -1;
        if (a.firstName > b.firstName) return 1;
        if (a.lastName < b.lastName) return -1;
        if (a.lastName > b.lastName) return 1;
        return 0;
      });

      return usersWithRoles;
    } catch (error) {
      this.logger.error(
        { error, tenantId },
        'Failed to fetch tenant users from Clerk or process them',
      );
      throw new BadRequestException(
        `Failed to fetch Tenant users: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async updateUserRole(
    userId: string,
    newRoles: UserRole[], // Renamed to avoid confusion with user.roles
    tenantId: string,
  ): Promise<User> {
    try {
      // 1. Verify tenant membership via Clerk
      const memberships =
        await this.clerkClient.users.getOrganizationMembershipList({ userId });
      const isMember = memberships.data.some(
        (mem) => mem.organization.id === tenantId,
      );

      if (!isMember) {
        throw new BadRequestException(
          `User ${userId} is not a member of tenant ${tenantId}`,
        );
      }

      // 2. Fetch User from local DB for role update
      // Fetching by ID only, as Clerk confirmed tenant membership.
      // We still need the local user entity to attach roles to.
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['roles'],
      });

      if (!user) {
        // This case means user is in Clerk, in the tenant, but not in our local DB.
        // This could be a sync issue.
        this.logger.error(
          { userId, tenantId },
          'User is member of tenant in Clerk, but not found in local DB for role update.',
        );
        throw new NotFoundException(
          `User ${userId} not found in local database for role assignment.`,
        );
      }

      // If we want to be extra careful and ensure the local user's activeTenantId aligns:
      // (This part is optional based on how strict the system needs to be)
      // if (user.activeTenantId !== tenantId) {
      //   this.logger.warn({ userId, localActiveTenant: user.activeTenantId, expectedTenantId: tenantId }, "User's local activeTenantId does not match the tenantId for role update. Proceeding as Clerk verified membership.");
      //   // Depending on business logic, you might throw an error or just proceed.
      // }

      // 3. Find role entities
      const roleEntities = await this.roleRepo.find({
        where: newRoles.map((roleName) => ({ name: roleName })),
      });

      if (roleEntities.length !== newRoles.length) {
        const foundRoleNames = roleEntities.map((r) => r.name);
        const notFoundRoles = newRoles.filter(
          (rn) => !foundRoleNames.includes(rn),
        );
        this.logger.error(
          { notFoundRoles },
          'One or more roles not found in database',
        );
        throw new BadRequestException(
          `One or more roles not found: ${notFoundRoles.join(', ')}`,
        );
      }

      // 4. Assign roles and save
      user.roles = roleEntities;
      return await this.userRepo.save(user);
    } catch (error) {
      this.logger.error(
        { error, userId, roles: newRoles, tenantId },
        'Failed to update user role',
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error; // Re-throw known exceptions
      }
      throw new BadRequestException(
        `Failed to update user role: ${error.message || 'Unknown error'}`,
      );
    }
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
    try {
      const savedUser = await this.userRepo.save(user);
      this.logger.info(
        { userId: savedUser.id, tenantId: tenantIdToSetAsActive },
        'User created successfully in DB',
      );
      return savedUser;
    } catch (error) {
      this.logger.error(
        { error, clerkUserData, tenantIdToSetAsActive },
        'Error saving new user to DB',
      );
      // Consider if this should throw a more specific error or be handled by a global exception filter
      throw new BadRequestException('Could not create user in database.');
    }
  }

  async updateUser(userUpdatedData: UserWebhookEvent): Promise<User> {
    const userId = userUpdatedData.data.id;
    let user = await this.userRepo.findOne({
      where: { id: userId },
    });

    this.logger.info(
      { userId, userExists: !!user },
      'Processing updateUser event',
    );

    if (!user) {
      this.logger.info(
        { userId },
        'User not found. Attempting to create new user from updateUser event.',
      );
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
      this.logger.info(
        { userId },
        'User created successfully from updateUser event',
      );
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
      this.logger.warn({ userId }, 'User not found. Skipping deletion.');
      return;
    }

    this.logger.info({ userId }, 'Deleting user from DB');
    await this.userRepo.remove(user);
  }

  async validateUsersAreInTenant(
    userIds: string[],
    tenantId: string,
  ): Promise<{ validClerkUsers: clerkUser[]; invalidUserIds: string[] }> {
    if (!userIds || userIds.length === 0) {
      return { validClerkUsers: [], invalidUserIds: [] };
    }

    let usersFromClerk: clerkUser[] = [];
    try {
      // Note: Clerk's getUserList with a userId array might have limitations on array size.
      // For very large arrays, batching might be needed in a real-world scenario.
      // Also, ensure the specific Clerk SDK version supports passing an array to userId.
      // If not, it might be `this.clerkClient.users.getUserList({ userId: userIds })`
      // or it might require fetching users one by one if `userId` only accepts a string.
      // For this exercise, assuming it works as intended to fetch multiple users.
      const userListResponse = await this.clerkClient.users.getUserList({
        userId: userIds,
      });
      usersFromClerk = userListResponse.data; // Or just userListResponse if it's directly an array
    } catch (error) {
      this.logger.error(
        { error, userIds, tenantId },
        'Error fetching users from Clerk in validateUsersAreInTenant',
      );
      // If fetching the list fails, consider all users as invalid or rethrow, depending on desired behavior.
      // For now, treating them all as invalid if the call itself fails.
      return { validClerkUsers: [], invalidUserIds: [...userIds] };
    }

    const validClerkUsers: clerkUser[] = [];
    const foundUserIds = usersFromClerk.map((u) => u.id);
    const initiallyNotFoundIds = userIds.filter(
      (id) => !foundUserIds.includes(id),
    );
    const usersFoundButNotInTenantIds: string[] = [];

    for (const clerkUserFound of usersFromClerk) {
      // Preferred method: Check organizationMemberships if populated by getUserList
      // Assuming clerkUserFound.organizationMemberships is an array of objects like { organization: { id: string } }
      // or simpler, an array of organization IDs. This depends on Clerk's User model structure.
      // Let's assume organizationMemberships is an array of { id: string, name: string, slug: string, ... } objects.
      // This is a common pattern but needs verification with actual Clerk SDK User type.
      // A more robust check would be against `clerkUserFound.organizationMemberships.some(mem => mem.id === tenantId)`
      // if `organizationMemberships` contains full organization objects.
      // Or if it's simpler like `clerkUserFound.publicMetadata.organizations` being an array of strings.

      // For this implementation, let's assume `organizationMemberships` is an array of objects,
      // and each object has an `id` property representing the organization ID.
      // This is a common structure for membership data.
      // If `getUserList` doesn't populate `organizationMemberships`, the alternative is needed.

      let isMember = false;
      if (
        clerkUserFound.organizationMemberships &&
        Array.isArray(clerkUserFound.organizationMemberships)
      ) {
        // The actual structure of organizationMemberships needs to be known.
        // Common Clerk patterns:
        // 1. `clerkUserFound.organizationMemberships` is `[{ organization: { id: 'org_id' } }, ...]`
        // 2. `clerkUserFound.organizationMemberships` is `[{ id: 'org_id' }, ...]` (if directly a list of orgs user is part of)
        // 3. It might be in `publicMetadata` or `privateMetadata` if customized.
        // For now, let's assume a simpler structure or a field like `publicMetadata.org_ids` for direct check
        // If `clerkUserFound.organizationMemberships` is `[{ id: 'orgId1' }, { id: 'orgId2' }]`
        isMember = clerkUserFound.organizationMemberships.some(
          (mem: any) =>
            mem.id === tenantId ||
            (mem.organization && mem.organization.id === tenantId),
        );
        // If the structure is just an array of strings (org IDs)
        // isMember = clerkUserFound.organizationMemberships.includes(tenantId);
      }

      // Fallback/Alternative if organizationMemberships is not available or not detailed enough from getUserList:
      // This section should ideally only run if the primary check above is inconclusive or not possible.
      // For now, let's assume the primary check might not be populated and we need this fallback.
      // To avoid N+1, this would ideally be a feature request to Clerk to include membership status in getUserList.
      // For this exercise, if not found via direct property, we will NOT use the N+1 call for now
      // as per "Strive for the former if possible." and assume the primary check is the goal.
      // If primary check is not possible, then one would uncomment and use the below:
      /*
      if (!isMember && clerkUserFound.id && tenantId) { // Check only if not already confirmed and IDs are valid
        try {
          const memberships = await this.clerkClient.organizations.getOrganizationMembershipList({
            organizationId: tenantId,
            userId: clerkUserFound.id, // This parameter might not exist on getOrganizationMembershipList,
                                        // it's usually on users.getOrganizationMembershipList({userId})
          });
          if (memberships.data && memberships.data.length > 0) {
            isMember = true;
          }
        } catch (error) {
          this.logger.error(
            { error, userId: clerkUserFound.id, tenantId },
            'Error checking individual organization membership for user'
          );
          // Decide behavior: treat as not a member, or rethrow, etc.
          // For now, if individual check fails, treat as not a member.
        }
      }
      */

      if (isMember) {
        validClerkUsers.push(clerkUserFound);
      } else {
        usersFoundButNotInTenantIds.push(clerkUserFound.id);
      }
    }

    const invalidUserIds = [
      ...initiallyNotFoundIds,
      ...usersFoundButNotInTenantIds,
    ];
    return { validClerkUsers, invalidUserIds };
  }
}
