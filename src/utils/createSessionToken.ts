import { PinoLogger } from 'nestjs-pino';

export async function createSessionToken( // this function is for testing only, should be removed in production
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
    logger.info(`Session Token: ${data.jwt}`);
    console.log(`SessionToken: ${data.jwt}`);
    return data.jwt;
  } catch (error) {
    logger.error('Failed to create session token:', error.message);
    throw error;
  }
}
