import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConnectedPlatform } from 'src/cross-platform/helpers/cross-platform.interface';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { ClerkAuthGuard } from 'src/guards/clerk-auth.guard';
import { OAuth2Service } from 'src/platform-auth/platform-auth.service';
import { PlatformsService } from './platforms.service';

@Controller('platforms')
export class PlatformController {
  constructor(
    private readonly oauth2Service: OAuth2Service,
    private readonly platformService: PlatformsService,
  ) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  async getConnectedPlatforms(
    @CurrentUser() userId: string,
  ): Promise<ConnectedPlatform[]> {
    const connectedAccountsMap =
      await this.platformService.getConnectedAccountsForUser(userId);

    return Object.values(SocialPlatform).map((platform) => ({
      platform,
      connected: connectedAccountsMap[platform].length > 0,
      scopes: this.oauth2Service.getPlatformScopes(platform),
      accounts: connectedAccountsMap[platform],
    }));
  }
}
