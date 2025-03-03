import { SocialPlatform } from '../common/enums/social-platform.enum';

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
