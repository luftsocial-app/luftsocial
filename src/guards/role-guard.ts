import { SetMetadata } from '@nestjs/common';

export enum Role {
  User = 'user',
  Admin = 'admin',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';

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

    this.logger.info({ requiredRoles });

    if (!requiredRoles) {
      return true;
    }
    const req = context.switchToHttp().getRequest();

    const user = req.auth;
    this.logger.info({ user, permissions: user.has({ role: 'org:member' }) });
    this.logger.info({ metatata: user.sessionClaims?.metadata.role });

    return requiredRoles.some((role) =>
      user.sessionClaims?.org_role.includes(role),
    );
  }
}
