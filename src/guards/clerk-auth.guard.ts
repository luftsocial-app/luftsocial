import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { clerkClient } from '@clerk/express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ClerkAuthGuard.name);
  }

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
      this.logger.info({ sessionId, session });

      if (!session || !session.userId) {
        throw new UnauthorizedException('Invalid session');
      }

      const user = await clerkClient.users.getUser(session.userId);
      console.log('user2323', user);
      request.user = user;
      return true;
    } catch (error) {
      this.logger.info({ error });

      if (error instanceof Error) {
        throw new UnauthorizedException(error.message);
      }
      throw new UnauthorizedException('Invalid session token');
    }
  }
}
