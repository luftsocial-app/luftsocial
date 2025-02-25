import { SocialPlatform } from 'src/enum/social-platform.enum';

export class PlatformError extends Error {
  constructor(
    public readonly platform: SocialPlatform,
    message: string,
    public readonly originalError?: any,
  ) {
    super(`${platform}: ${message}`);
    this.name = 'PlatformError';
  }
}
