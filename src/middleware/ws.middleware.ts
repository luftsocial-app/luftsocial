import * as jwt from 'jsonwebtoken';
import { TenantService } from '../user-management/tenant.service';
import { createSessionToken } from '../utils/createSessionToken';

export function wsAuthMiddleware(
  tenantService: TenantService,
  logger,
  configService,
) {
  return async (socket, next) => {
    const tenantId = socket.handshake.headers['x-tenant-id'] as string;
    tenantService.setTenantId(tenantId); // Use the TenantService to set the tenant ID

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
      socket.data.user = user; // Attach the user object to socket.data

      const sessionId = user['sid'];
      const clerkSecretKey = configService.get('clerk.secretKey');

      // testing: renew session by 1 hr

      if (process.env.NODE_ENV === 'development')
        await createSessionToken(sessionId, clerkSecretKey, this.logger);

      next();
    } catch (error) {
      logger.error({ error });
      next(new Error('Invalid authentication token'));
    }
  };
}
