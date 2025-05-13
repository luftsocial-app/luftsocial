import { SetMetadata } from '@nestjs/common';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';

export enum Role {
  User = 'user',
  Admin = 'admin',
  Creator = 'creator',
  Member = 'member',
}

// Map Clerk roles to our application roles
export const CLERK_ROLE_MAPPING = {
  'org:admin': Role.Admin,
  'org:member': Role.Member,
};

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RoleGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    this.logger.info({ requiredRoles, requiredPermissions });

    // If no roles or permissions are required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.auth;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    this.logger.info({
      user,
      orgRole: user.sessionClaims?.org_role,
      permissions: user.sessionClaims?.org_permissions,
    });

    // Check roles if required
    if (requiredRoles && requiredRoles.length > 0) {
      // Get the user's Clerk organization role
      const clerkRole = user.sessionClaims?.org_role;

      if (!clerkRole) {
        this.logger.warn('User has no organization role');
        return false;
      }

      // Map Clerk role to application role
      const appRole = CLERK_ROLE_MAPPING[clerkRole] || clerkRole;

      // Check if the user has any of the required roles
      const hasRequiredRole = requiredRoles.includes(appRole);

      if (!hasRequiredRole) {
        this.logger.warn(
          `User lacks required role. Has: ${appRole}, Required one of: ${requiredRoles.join(', ')}`,
        );
        return false;
      }
    }

    // Check permissions if required
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = user.sessionClaims?.org_permissions || [];

      // Check if the user has all required permissions
      const hasAllRequiredPermissions = requiredPermissions.every(
        (permission) => {
          const clerkPermission = permission.startsWith('org:')
            ? permission
            : `org:sys_${permission}`;

          return userPermissions.includes(clerkPermission);
        },
      );

      if (!hasAllRequiredPermissions) {
        this.logger.warn(
          `User lacks required permissions. Has: ${userPermissions.join(', ')}, Required: ${requiredPermissions.join(', ')}`,
        );
        return false;
      }
    }

    return true;
  }
}
