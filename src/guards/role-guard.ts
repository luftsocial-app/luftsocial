import { SetMetadata } from '@nestjs/common';

export enum Role {
  User = 'user',
  Admin = 'admin',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log({ requiredRoles });

    if (!requiredRoles) {
      return true;
    }
    const req = context.switchToHttp().getRequest();

    const user = req.auth;
    console.log({ user, permissions: user.has({ role: 'org:member' }) });
    console.log({ metatata: user.sessionClaims?.metadata.role });

    return requiredRoles.some((role) =>
      user.sessionClaims?.org_role.includes(role),
    );
  }
}
