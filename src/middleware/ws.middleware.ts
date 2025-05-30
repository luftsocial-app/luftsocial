import * as jwt from 'jsonwebtoken';
import { TenantService } from '../user-management/tenant.service';
import { createSessionToken } from '../utils/createSessionToken';
import { ConfigService } from '@nestjs/config';

export function wsAuthMiddleware(
  tenantService: TenantService,
  logger,
  configService: ConfigService,
) {
  return async (socket, next) => {
    const tenantId =
      socket.handshake.auth?.tenantId ||
      socket.handshake.query?.['x-tenant-id'] ||
      socket.handshake.headers['x-tenant-id'];
    tenantService.setTenantId(tenantId);

    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token) {
      return next(new Error('Authentication token is missing'));
    }

    const isDev = process.env.NODE_ENV === 'development';
    const publicKey = isDev
      ? process.env.CLERK_JWT_PUBLIC_KEY.replace(/\\n/g, '\n')
      : configService.get('clerk.clerkPublicKey');

    try {
      const user = jwt.verify(token, publicKey, {
        algorithms: ['RS256'], // Specify the RS256 algorithm
      });

      user['tenantId'] = tenantId;
      socket.data.user = user; // Attach the user object to socket.data

      console.log("user............................:",user)

      const sessionId = user['sid'];
      const clerkSecretKey = configService.get('clerk.secretKey');

      // testing: renew session by 1 hr

      if (process.env.NODE_ENV === 'development')
        await createSessionToken(sessionId, clerkSecretKey, logger);

      next();
    } catch (error) {
      logger.error({
        message: error?.message,
        stack: error?.stack,
        error,
      });
      next(new Error('Invalid authentication token'));
    }
  };
}
