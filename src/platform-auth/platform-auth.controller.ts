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
import { AuthObject } from '@clerk/express';

@UseGuards(ClerkAuthGuard)
@Controller('auth')
export class PlatformAuthController {
  constructor(private readonly PlatformAuthService: PlatformAuthService) {}

  @Get(':platform/authorize')
  async authorize(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @CurrentUser() user: AuthObject,
  ): Promise<{ url: string }> {
    const url = await this.PlatformAuthService.getAuthorizationUrl(
      platform,
      user.userId,
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
    @CurrentUser() user: AuthObject,
  ): Promise<TokenResponse> {
    return this.PlatformAuthService.refreshToken(platform, user.userId);
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
