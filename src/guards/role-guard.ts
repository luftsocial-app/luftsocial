import {
  SetMetadata,
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { UserService } from '../user-management/user.service'; // Import UserService
import { UserRole } from '../common/enums/roles'; // Import UserRole

// export enum Role { // This local Role enum is no longer needed, will use UserRole from common/enums
//   User = 'user',
//   Admin = 'admin',
// }

export const ROLES_KEY = 'roles';
// Updated Roles decorator to use UserRole enum
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly logger: PinoLogger,
    private readonly userService: UserService, // Inject UserService
  ) {
    this.logger.setContext(RoleGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Use getAllAndOverride to match the original implementation's flexibility for roles on class and handler
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No specific roles required, access granted
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.auth?.userId;

    if (!userId) {
      this.logger.warn(
        'No userId found on request.auth.userId. Ensure ClerkAuthGuard runs before RoleGuard.',
      );
      return false; // No user ID, access denied
    }

    try {
      const user = await this.userService.findUserWithRelations(userId);

      if (!user || !user.roles || user.roles.length === 0) {
        this.logger.warn(
          { userId, requiredRoles },
          'User not found by UserService, or has no roles.',
        );
        return false; // User not found, or has no roles, access denied
      }

      const hasRequiredRole = requiredRoles.some((roleEnum) =>
        user.roles.some((userRole) => userRole.name === roleEnum),
      );

      if (!hasRequiredRole) {
        this.logger.info(
          { userId, userRoles: user.roles.map((r) => r.name), requiredRoles },
          'User does not have any of the required roles.',
        );
      }

      return hasRequiredRole;
    } catch (error) {
      this.logger.error(
        { error, userId, requiredRoles },
        'Error in RoleGuard while fetching user or checking roles',
      );
      // If findUserWithRelations throws (e.g., Clerk API error, or NotFoundException if user not in Clerk), deny access
      return false;
    }
  }
}
