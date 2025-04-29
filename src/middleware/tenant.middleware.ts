import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../user-management/tenant.service';

async function createSessionToken( // this function is for testing only, should be removed in production
  sessionId: string,
  clerkSecretKey: string,
  logger: PinoLogger,
) {
  logger.debug({ sessionId, clerkSecretKey }, 'Creating session token');

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
          expires_in_seconds: 9600,
        }),
      },
    );

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(`Error ${response.status}: ${errorDetails.message}`);
    }

    const data = await response.json();
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
    const isLuftSocialAdmin =
      req.headers['X-LUFTSOCIAL-ADMIN'] === 'true' ||
      req.headers['x-luftsocial-admin'] === 'true';

    if (!tenantId && !isLuftSocialAdmin) {
      this.logger.warn('`X-TENANT-ID` not provided');
      req['tenantId'] = null;
      req['isLuftSocialAdmin'] = null;

      // throw error neither tenantId nor isLuftSocialAdmin is provided
      throw new UnauthorizedException(
        'Either `X-TENANT-ID` or `X-LUFTSOCIAL-ADMIN` header is required',
      );
    }

    this.tenantService.setTenantId(tenantId);
    req['tenantId'] = tenantId;
    req['isLuftSocialAdmin'] = isLuftSocialAdmin;
    next();
  }
}
