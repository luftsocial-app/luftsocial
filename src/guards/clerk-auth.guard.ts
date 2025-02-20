import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { clerkClient } from '@clerk/express';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const sessionId = request.auth?.sessionId;

    if (!sessionId) {
      throw new UnauthorizedException('No session token provided');
    }

    try {
      const session = await clerkClient.sessions.getSession(sessionId);
      console.log({ sessionId, session });

      if (!session || !session.userId) {
        throw new UnauthorizedException('Invalid session');
      }

      const user = await clerkClient.users.getUser(session.userId);
      request.user = user;
      return true;
    } catch (error) {
      console.log({ error });

      if (error instanceof Error) {
        throw new UnauthorizedException(error.message);
      }
      throw new UnauthorizedException('Invalid session token');
    }
  }
}
