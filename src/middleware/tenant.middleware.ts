import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../user-management/tenant/tenant.service';
import { PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

async function createSessionToken( // this function is for testing only, should be removed in production
  sessionId: string,
  clerkSecretKey: string,
  logger: PinoLogger,
) {
  logger.info({ sessionId, clerkSecretKey }, 'Creating session token');

  try {
    const response = await fetch(
      'https://api.clerk.com/v1/sessions/' + sessionId + '/tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_in_seconds: 3600,
        }),
      },
    );

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(`Error ${response.status}: ${errorDetails.message}`);
    }

    const data = await response.json();
    logger.info(`Session Token: ${data.jwt}`);
    return data.jwt;
  } catch (error) {
    logger.error('Failed to create session token:', error.message);
    throw error;
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private tenantService: TenantService,
    private readonly logger: PinoLogger,
    private configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const sessionId = req.auth?.sessionId;
    const clerkSecretKey = this.configService.get('clerk.secretKey');

    console.log('Middleware hit:', req.method, req.originalUrl);

    // testing: renew session by 1 hr
    const customJWT = await createSessionToken(
      sessionId,
      clerkSecretKey,
      this.logger,
    );
    req.headers['authorization'] = `Bearer ${customJWT}`;
    const tenantId =
      (req.headers['X-TENANT-ID'] as string) ||
      (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      this.logger.warn('`X-TENANT-ID` not provided');
      req['tenantId'] = null;
      return next();
    }
    this.tenantService.setTenantId(tenantId);
    req['tenantId'] = tenantId;
    next();
  }
}
