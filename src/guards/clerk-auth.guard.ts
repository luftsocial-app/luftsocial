import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  auth?: {
    userId?: string;
  };
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return !!request.auth?.userId; // Allow access if authenticated
  }
}
