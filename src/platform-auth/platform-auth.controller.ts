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
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { ClerkAuthGuard } from 'src/guards/clerk-auth.guard';
import { TokenResponse } from 'src/platforms/platform-service.interface';
import { OAuth2Service } from './platform-auth.service';

@Controller('auth')
export class PlatformAuthController {
  constructor(private readonly oauth2Service: OAuth2Service) {}

  @Get(':platform/authorize')
  @UseGuards(ClerkAuthGuard)
  async authorize(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @CurrentUser() userId: string,
  ): Promise<{ url: string }> {
    const url = await this.oauth2Service.getAuthorizationUrl(platform, userId);
    return { url };
  }

  @Get(':platform/callback')
  @UseGuards(ClerkAuthGuard)
  async handleCallback(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<TokenResponse> {
    return this.oauth2Service.handleCallback(platform, code, state);
  }

  @Post(':platform/refresh')
  @UseGuards(ClerkAuthGuard)
  async refreshToken(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenResponse> {
    return this.oauth2Service.refreshToken(platform, refreshToken);
  }

  @Post(':platform/revoke')
  @UseGuards(ClerkAuthGuard)
  async revokeToken(
    @Param('platform', new ParseEnumPipe(SocialPlatform))
    platform: SocialPlatform,
    @Body('token') token: string,
  ): Promise<void> {
    await this.oauth2Service.revokeToken(platform, token);
  }

  @Get('platforms')
  @UseGuards(ClerkAuthGuard)
  getAvailablePlatforms(): SocialPlatform[] {
    return Object.values(SocialPlatform);
  }
}
