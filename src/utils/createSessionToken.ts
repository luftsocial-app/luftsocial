import { PinoLogger } from 'nestjs-pino';
import * as config from 'config';

export async function createSessionToken( // this function is for testing only, should be removed in production
  sessionId: string,
  clerkSecretKeyParam: string,
  logger: PinoLogger,
): Promise<string> {
  const clerkSecretKey =
    clerkSecretKeyParam || config.get<string>('clerk.clerkSecretKey');

  if (process.env.NODE_ENV === 'development' && !clerkSecretKey) {
    throw new Error('Clerk secret key is not configured');
  }

  logger.debug({ sessionId, clerkSecretKey }, 'Creating session token');

  // console.log('clerkSecretKey............', clerkSecretKey);

  console.log('sessionId............:', sessionId);

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
      console.log('errorDetails..................:', errorDetails);

      throw new Error(
        `Error Details ${response.status}: ${JSON.stringify(errorDetails)}`,
      );
    }

    const data = await response.json();
    logger.info(`Session Token: ${data.jwt}`);
    return data.jwt;
  } catch (error) {
    logger.error('Failed to create session token:', error);
    throw error;
  }
}
