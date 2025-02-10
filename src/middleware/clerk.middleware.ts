import { clerkMiddleware } from '@clerk/express';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ClerkMiddleware implements NestMiddleware {
  private clerk = clerkMiddleware();

  constructor(private configService: ConfigService) {
    this.clerk = clerkMiddleware({
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.clerk(req, res, next);
  }
}
