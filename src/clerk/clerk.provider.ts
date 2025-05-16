import { createClerkClient } from '@clerk/backend';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as config from 'config';

export const CLERK_CLIENT = 'CLERK_CLIENT';
export const ClerkClientProvider = {
  provide: CLERK_CLIENT,
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('ClerkClientProvider');
    process.env.CLERK_SECRET_KEY = config.get('clerk.secretKey');
    process.env.CLERK_PUBLISHABLE_KEY = config.get('clerk.clerkPublicKey');

    const secretKey =
      process.env.CLERK_SECRET_KEY ||
      configService.get<string>('CLERK_SECRET_KEY');

    const publishableKey =
      process.env.CLERK_PUBLISHABLE_KEY ||
      configService.get('CLERK_PUBLISHABLE_KEY');

    // Validate keys are available
    if (!secretKey) {
      logger.error(
        'Clerk secret key not found in environment variables or config',
      );
      throw new Error('Clerk secret key is required');
    }

    // Log initialization with key prefix (safe for logging)
    logger.log(
      `Initializing Clerk with secret key: ${secretKey.substring(0, 4)}...`,
    );

    try {
      // Create Clerk client
      const client = createClerkClient({
        secretKey,
        publishableKey,
      });

      logger.log('Clerk client initialized successfully');
      return client;
    } catch (error) {
      logger.error(`Failed to initialize Clerk client: ${error.message}`);
      throw error;
    }
  },
  inject: [ConfigService],
};
