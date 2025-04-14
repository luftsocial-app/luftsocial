import {
  Controller,
  Get,
  UseGuards,
  Param,
  ParseEnumPipe,
  Query,
  Post,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';
import { TokenResponse } from '../platforms/platform-service.interface';
import { PlatformAuthService } from './platform-auth.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';

@UseGuards(ClerkAuthGuard)
@Controller('auth')
export class PlatformAuthController {
  constructor(private readonly PlatformAuthService: PlatformAuthService) {}

  @Get(':platform/authorize')
  async authorize(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @CurrentUser() user: any,
  ): Promise<{ url: string }> {
    const { userId } = user;
    const url = await this.PlatformAuthService.getAuthorizationUrl(
      platform,
      userId,
    );
    return { url };
  }

  @Get(':platform/callback')
  async handleCallback(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<TokenResponse> {
    return this.PlatformAuthService.handleCallback(platform, code, state);
  }

  @Post(':platform/refresh')
  async refreshToken(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @CurrentUser() user: any,
  ): Promise<TokenResponse> {
    const { userId } = user;
    return this.PlatformAuthService.refreshToken(platform, userId);
  }

  @Post(':platform/revoke')
  async revokeToken(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Body('token') token: string,
  ): Promise<void> {
    await this.PlatformAuthService.revokeToken(platform, token);
  }

  @Get('platforms')
  getAvailablePlatforms(): SocialPlatform[] {
    return Object.values(SocialPlatform);
  }
}
