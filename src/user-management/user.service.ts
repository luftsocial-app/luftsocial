import {
  Injectable,
  BadRequestException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { ClerkClient, clerkClient, User as clerkUser } from '@clerk/express';
import { UserRole } from '../common/enums/roles';
import { UserWebhookEvent, UserJSON } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';
import { CLERK_CLIENT } from '../clerk/clerk.provider';
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
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
  ) {
    this.logger.setContext(UserService.name);
  }

  async getUsers(): Promise<clerkUser[]> {
    const users = await clerkClient.users.getUserList();
    return users.data;
  }

  async findById(clerkId: string, tenantIdToScope?: string): Promise<User | null> {
    this.logger.info({ clerkId, tenantIdToScope }, 'Attempting to find user by clerkId, optionally scoped to tenantId');
    const user = await this.userRepo.findOne({
      where: { clerkId }, // Query by clerkId
      relations: ['roles', 'tenants'], // Ensure tenants are loaded to check membership
    });

    if (!user) {
      this.logger.warn({ clerkId }, 'User not found with the provided clerkId');
      return null;
    }

    if (tenantIdToScope) {
      const isUserInTenant = user.tenants && user.tenants.some(tenant => tenant.id === tenantIdToScope);
      if (!isUserInTenant) {
        this.logger.warn(
          { clerkId, userId: user.id, tenantIdToScope },
          'User found, but not a member of the specified tenant for scoping. Returning null.',
        );
        return null; // User not found within the specified tenant scope
      }
      this.logger.info(
        { clerkId, userId: user.id, tenantIdToScope },
        'User found and is a member of the specified tenant.',
      );
    } else {
      this.logger.info(
        { clerkId, userId: user.id },
        'User found. No tenantIdToScope provided, returning user without specific tenant check (beyond activeTenantId if relevant elsewhere).',
      );
    }

    // If tenantIdToScope was provided and matched, or if no tenantIdToScope was provided, return the user.
    // The roles relation is already loaded.
    // Note: The original query in findById was:
    // where: { id, tenants: { id: this.tenantService.getTenantId() } }, relations: ['roles']
    // This change means findById no longer implicitly uses this.tenantService.getTenantId().
    // Callers like UserController.findUser must now explicitly pass the tenantId for scoping.
    return user;
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
    // Since findById now takes clerkId and optionally tenantId,
    // we need to decide how to call it here.
    // syncClerkUser is usually called in a context where we know the tenant.
    // Let's assume we scope it to the tenantId provided to syncClerkUser.
    let user = await this.findById(clerkId, tenantId);
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

      if (globalUser) { // User exists globally but not in this tenant (or tenant scope wasn't checked before)
          user = globalUser;
          // Add user to this tenant if not already part of it
          const tenantEntity = await this.tenantRepo.findOneBy({ id: tenantId });
          if (tenantEntity) {
            if (!user.tenants) user.tenants = [];
            if (!user.tenants.some(t => t.id === tenantId)) {
                user.tenants.push(tenantEntity);
            }
            // If user's activeTenantId is not set, set it to this tenant.
            if (!user.activeTenantId) {
                user.activeTenantId = tenantId;
            }
          }
      } else { // User does not exist globally, create new
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
            this.logger.warn({ tenantId }, "Tenant not found for syncClerkUser, cannot associate user with tenant.");
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

  async createUser(userCreatedData: UserWebhookEvent, tenantIdToSetAsActive?: string): Promise<User> {
    const { data: clerkUserData } = userCreatedData;
    const primaryEmail = clerkUserData.email_addresses?.find(
      (email) => email.id === clerkUserData.primary_email_address_id,
    )?.email_address;

    if (!primaryEmail) {
      this.logger.error({ clerkUserData }, 'User does not have a primary email address.');
      throw new BadRequestException('User must have a primary email address.');
    }
    
    const userObject = {
      id: clerkUserData.id,
      clerkId: clerkUserData.id,
      email: primaryEmail,
      username: clerkUserData.username || primaryEmail, // Fallback to email if username is not set
      firstName: clerkUserData.first_name || '',
      lastName: clerkUserData.last_name || '',
      // activeTenantId will be set based on the logic in ClerkWebhookService
      // If tenantIdToSetAsActive is provided, use it. Otherwise, it might be set later or remain null.
      activeTenantId: tenantIdToSetAsActive || null, 
    };

    const user = this.userRepo.create(userObject);
    try {
      const savedUser = await this.userRepo.save(user);
      this.logger.info({ userId: savedUser.id, tenantId: tenantIdToSetAsActive }, 'User created successfully in DB');
      return savedUser;
    } catch (error) {
      this.logger.error({ error, clerkUserData, tenantIdToSetAsActive }, 'Error saving new user to DB');
      // Consider if this should throw a more specific error or be handled by a global exception filter
      throw new BadRequestException('Could not create user in database.');
    }
  }

  async updateUser(userUpdatedData: UserWebhookEvent): Promise<User> {
    const { data: clerkUserData } = userUpdatedData;
    const user = await this.userRepo.findOne({
      where: { id: clerkUserData.id },
    });

    this.logger.info({ userId: clerkUserData.id, clerkUserData }, 'User update data from webhook');

    if (!user) {
      this.logger.warn({ userId: clerkUserData.id }, 'User not found for update, attempting to create instead.');
      // Potentially, this could be a new user event that was missed or delayed.
      // Depending on business logic, you might want to create them here.
      // For now, we'll follow the pattern of creating if not found, similar to original code.
      const primaryEmailForNewUser = clerkUserData.email_addresses?.find(
        (email) => email.id === clerkUserData.primary_email_address_id,
      )?.email_address;
      if (!primaryEmailForNewUser) {
        this.logger.error({ clerkUserData }, 'New user for update does not have a primary email address.');
        throw new BadRequestException('User must have a primary email address for creation during update.');
      }

      const userObject = {
        id: clerkUserData.id,
        clerkId: clerkUserData.id,
        email: primaryEmailForNewUser,
        username: clerkUserData.username || primaryEmailForNewUser,
        firstName: clerkUserData.first_name || '',
        lastName: clerkUserData.last_name || '',
        // Assuming activeTenantId might come from custom attributes or needs other logic if user is new here
        activeTenantId: clerkUserData.public_metadata?.activeTenantId || clerkUserData.private_metadata?.activeTenantId || null,
      };
      const newUser = this.userRepo.create(userObject);
      try {
        const savedNewUser = await this.userRepo.save(newUser);
        this.logger.info({ userId: savedNewUser.id }, 'User created successfully during update operation because original was not found');
        return savedNewUser;
      } catch (error) {
        this.logger.error({ error, clerkUserData }, 'Error saving new user (during update) to DB');
        throw new BadRequestException('Could not create user during update in database.');
      }
    }
    
    const primaryEmail = clerkUserData.email_addresses?.find(
      (email) => email.id === clerkUserData.primary_email_address_id,
    )?.email_address;

    Object.assign(user, {
      email: primaryEmail || user.email,
      username: clerkUserData.username || user.username, // Keep existing if new username is null/empty
      firstName: clerkUserData.first_name || user.firstName, // Keep existing if new first_name is null/empty
      lastName: clerkUserData.last_name || user.lastName, // Keep existing if new last_name is null/empty
      // activeTenantId update logic might need to be more sophisticated,
      // e.g., if it's changed via organization membership webhooks or other app logic.
      // For now, we're not updating it directly from user.updated, assuming other processes handle tenant association.
    });
    
    try {
      const updatedUser = await this.userRepo.save(user);
      this.logger.info({ userId: updatedUser.id }, 'User updated successfully in DB');
      return updatedUser;
    } catch (error) {
      this.logger.error({ error, clerkUserData }, 'Error saving updated user to DB');
      throw new BadRequestException('Could not update user in database.');
    }
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
