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
import { OAuth2Service } from './platform-auth.service';
import { SocialPlatform } from '../common/enums/social-platform.enum';

@UseGuards(ClerkAuthGuard)
@Controller('auth')
export class PlatformAuthController {
  constructor(private readonly oauth2Service: OAuth2Service) {}

  @Get(':platform/authorize')
  async authorize(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @CurrentUser() userId: string,
  ): Promise<{ url: string }> {
    const url = await this.oauth2Service.getAuthorizationUrl(platform, userId);
    return { url };
  }

  @Get(':platform/callback')
  async handleCallback(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<TokenResponse> {
    return this.oauth2Service.handleCallback(platform, code, state);
  }

  @Post(':platform/refresh')
  async refreshToken(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenResponse> {
    return this.oauth2Service.refreshToken(platform, refreshToken);
  }

  @Post(':platform/revoke')
  async revokeToken(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Body('token') token: string,
  ): Promise<void> {
    await this.oauth2Service.revokeToken(platform, token);
  }

  @Get('platforms')
  getAvailablePlatforms(): SocialPlatform[] {
    return Object.values(SocialPlatform);
  }
}
