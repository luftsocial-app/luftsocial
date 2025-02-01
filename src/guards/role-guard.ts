import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<{ roles: string[] }>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles || requiredRoles.roles.length === 0) {
      return true; // No roles required; grant access.
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log({ user: user.realm_access, requiredRoles });

    if (
      !user ||
      !user.realm_access?.roles ||
      !requiredRoles?.roles.some((role) => user.realm_access.roles.includes(role))
    ) {
      throw new ForbiddenException('Forbidden resource');
    }

    return true;
  }
}
